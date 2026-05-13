import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.ai import chat, chat_json
from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_default_board, get_writable_board
from backend.models import Board, KanbanCard, KanbanColumn, User
from backend.routers.boards import _compact_active_positions

router = APIRouter(prefix="/api/ai")


class MessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[MessageIn]
    board_id: int | None = None


class CardUpdate(BaseModel):
    id: str | None = None
    column_id: str | None = None
    title: str | None = None
    details: str | None = None
    delete: bool = False


class AIChatResponse(BaseModel):
    message: str
    board_updates: list[CardUpdate] = []


@router.get("/ping")
async def ping(user: User = Depends(require_user)):
    reply = await chat([{"role": "user", "content": "What is 2+2? Reply with just the number."}])
    return {"reply": reply}


def _board_snapshot(board: Board) -> str:
    cols = []
    for col in sorted(board.columns, key=lambda c: c.position):
        cards = [
            {"id": str(c.id), "title": c.title}
            for c in sorted(col.cards, key=lambda c: c.position)
            if c.archived_at is None
        ]
        cols.append({"id": str(col.id), "title": col.title, "cards": cards})
    return json.dumps({"columns": cols}, indent=2)


def _find_active_card(db: Session, board_id: int, card_id: int) -> KanbanCard | None:
    return (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(
            KanbanCard.id == card_id,
            KanbanColumn.board_id == board_id,
            KanbanCard.archived_at.is_(None),
        )
        .first()
    )


def _create_card(u: CardUpdate, board: Board, db: Session) -> None:
    if not u.column_id or not u.title:
        return
    col = db.query(KanbanColumn).filter_by(id=int(u.column_id), board_id=board.id).first()
    if not col:
        return
    max_pos = max((c.position for c in col.cards), default=-1)
    db.add(KanbanCard(
        column_id=col.id,
        title=u.title,
        details=u.details or "",
        position=max_pos + 1,
    ))


def _archive_card(card: KanbanCard, db: Session) -> None:
    col_id = card.column_id
    card.archived_at = datetime.now(timezone.utc)
    db.flush()
    _compact_active_positions(db, col_id)


def _move_card_to_column(card: KanbanCard, new_column_id: int, board: Board, db: Session) -> None:
    new_col = db.query(KanbanColumn).filter_by(id=new_column_id, board_id=board.id).first()
    if not new_col:
        return
    old_col_id = card.column_id
    card.column_id = new_col.id
    max_pos = max((c.position for c in new_col.cards if c.id != card.id), default=-1)
    card.position = max_pos + 1
    db.flush()
    _compact_active_positions(db, old_col_id)


def _update_card(u: CardUpdate, card: KanbanCard, board: Board, db: Session) -> None:
    if u.title is not None:
        card.title = u.title
    if u.details is not None:
        card.details = u.details
    if u.column_id is not None and int(u.column_id) != card.column_id:
        _move_card_to_column(card, int(u.column_id), board, db)


def _apply_updates(updates: list[CardUpdate], board: Board, db: Session) -> None:
    for u in updates:
        if u.id is None:
            _create_card(u, board, db)
            continue
        card = _find_active_card(db, board.id, int(u.id))
        if not card:
            continue
        if u.delete:
            _archive_card(card, db)
        else:
            _update_card(u, card, board, db)
    db.commit()


_SYSTEM_PROMPT_TEMPLATE = (
    "You are an AI assistant for a Kanban board app.\n\n"
    "Current board state:\n{board}\n\n"
    "Respond ONLY with a JSON object matching this exact schema:\n"
    '{{"message": "<reply to user>", "board_updates": []}}\n\n'
    "Each entry in board_updates must have:\n"
    '  "id": card id as string, or null to create a new card\n'
    '  "column_id": column id as string (required when creating or moving)\n'
    '  "title": string or null\n'
    '  "details": string or null\n'
    '  "delete": true to delete the card\n\n'
    "Leave board_updates as [] when no changes are needed."
)


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    body: ChatRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = (
        get_writable_board(body.board_id, user, db)
        if body.board_id is not None
        else get_default_board(user, db)
    )
    system_content = _SYSTEM_PROMPT_TEMPLATE.format(board=_board_snapshot(board))
    messages = [{"role": "system", "content": system_content}] + [
        {"role": m.role, "content": m.content} for m in body.messages
    ]

    try:
        raw = await chat_json(messages)
        response = AIChatResponse(**raw)
    except Exception:
        raise HTTPException(status_code=500, detail="AI returned an unexpected response")

    if response.board_updates:
        _apply_updates(response.board_updates, board, db)

    return response
