"""Back-compat single-board API.

These endpoints operate on the user's default (oldest) board so the existing
frontend keeps working unchanged. New code should use /api/boards/{id}/...
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_default_board
from backend.models import KanbanCard, KanbanColumn, User
from backend.routers.boards import _board_full, _serialize_card

Priority = Literal["low", "medium", "high"]

router = APIRouter()


class RenameBody(BaseModel):
    title: str = Field(min_length=1, max_length=128)


class CreateCardBody(BaseModel):
    column_id: int
    title: str = Field(min_length=1, max_length=256)
    details: str = ""
    priority: Priority = "medium"
    due_date: date | None = None


class MoveCardBody(BaseModel):
    column_id: int
    position: int


@router.get("/api/board")
def read_board(user: User = Depends(require_user), db: Session = Depends(get_db)):
    board = get_default_board(user, db)
    # Existing frontend doesn't read "id" / "name"; the extra fields are harmless.
    return _board_full(board)


@router.post("/api/board/columns/{col_id}/rename")
def rename_column(
    col_id: int,
    body: RenameBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_default_board(user, db)
    col = db.query(KanbanColumn).filter_by(id=col_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    col.title = body.title.strip()
    db.commit()
    return {"ok": True}


@router.post("/api/board/cards")
def create_card(
    body: CreateCardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_default_board(user, db)
    col = db.query(KanbanColumn).filter_by(id=body.column_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    max_pos = max((c.position for c in col.cards), default=-1)
    card = KanbanCard(
        column_id=col.id,
        title=body.title.strip(),
        details=body.details,
        priority=body.priority,
        due_date=body.due_date,
        position=max_pos + 1,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.delete("/api/board/cards/{card_id}")
def archive_card(
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Soft-delete on the legacy single-board endpoint — mirrors the new /api/boards behaviour."""
    from datetime import datetime, timezone

    board = get_default_board(user, db)
    card = (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(
            KanbanCard.id == card_id,
            KanbanColumn.board_id == board.id,
            KanbanCard.archived_at.is_(None),
        )
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col_id = card.column_id
    card.archived_at = datetime.now(timezone.utc)
    db.flush()
    remaining = (
        db.query(KanbanCard)
        .filter(KanbanCard.column_id == col_id, KanbanCard.archived_at.is_(None))
        .order_by(KanbanCard.position)
        .all()
    )
    for i, c in enumerate(remaining):
        c.position = i
    db.commit()
    return {"ok": True}


@router.post("/api/board/cards/{card_id}/move")
def move_card(
    card_id: int,
    body: MoveCardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_default_board(user, db)
    card = (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(KanbanCard.id == card_id, KanbanColumn.board_id == board.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    target_col = db.query(KanbanColumn).filter_by(id=body.column_id, board_id=board.id).first()
    if not target_col:
        raise HTTPException(status_code=404, detail="Column not found")

    old_col_id = card.column_id
    card.column_id = target_col.id
    db.flush()

    if old_col_id != target_col.id:
        old_cards = (
            db.query(KanbanCard)
            .filter_by(column_id=old_col_id)
            .order_by(KanbanCard.position)
            .all()
        )
        for i, c in enumerate(old_cards):
            c.position = i
        db.flush()

    other_cards = (
        db.query(KanbanCard)
        .filter(KanbanCard.column_id == target_col.id, KanbanCard.id != card_id)
        .order_by(KanbanCard.position)
        .all()
    )
    new_pos = max(0, min(body.position, len(other_cards)))
    other_cards.insert(new_pos, card)
    for i, c in enumerate(other_cards):
        c.position = i
    db.commit()
    return {"ok": True}
