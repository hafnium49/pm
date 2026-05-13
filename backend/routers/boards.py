from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import (
    get_owned_board,
    get_readable_board,
    get_writable_board,
)
from backend.models import Board, BoardMembership, KanbanCard, KanbanColumn, User
from backend.seed import DEFAULT_COLUMNS

router = APIRouter(prefix="/api/boards")

Priority = Literal["low", "medium", "high"]


class CreateBoardBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class RenameBoardBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class RenameColumnBody(BaseModel):
    title: str = Field(min_length=1, max_length=128)


class AddColumnBody(BaseModel):
    title: str = Field(min_length=1, max_length=128)


class ReorderColumnsBody(BaseModel):
    column_ids: list[int] = Field(min_length=1)


class CreateCardBody(BaseModel):
    column_id: int
    title: str = Field(min_length=1, max_length=256)
    details: str = ""
    priority: Priority = "medium"
    due_date: date | None = None


class UpdateCardBody(BaseModel):
    """Partial update; any field set to None is left untouched."""
    title: str | None = Field(default=None, min_length=1, max_length=256)
    details: str | None = None
    priority: Priority | None = None
    due_date: date | None = None
    clear_due_date: bool = False


class MoveCardBody(BaseModel):
    column_id: int
    position: int


def _serialize_card(card: KanbanCard) -> dict:
    items = list(card.checklist_items or [])
    return {
        "id": str(card.id),
        "title": card.title,
        "details": card.details,
        "priority": card.priority or "medium",
        "due_date": card.due_date.isoformat() if card.due_date else None,
        "labels": [
            {"id": str(label.id), "name": label.name, "color": label.color}
            for label in (card.labels or [])
        ],
        "comment_count": len(card.comments or []),
        "checklist_total": len(items),
        "checklist_done": sum(1 for i in items if i.done),
    }


def _board_summary(board: Board, role: str = "owner") -> dict:
    return {
        "id": str(board.id),
        "name": board.name,
        "role": role,
        "column_count": len(board.columns),
        "card_count": sum(
            1 for c in board.columns for card in c.cards if card.archived_at is None
        ),
    }


def _board_full(board: Board) -> dict:
    columns = []
    cards: dict[str, dict] = {}
    for col in sorted(board.columns, key=lambda c: c.position):
        card_ids = []
        for card in sorted(col.cards, key=lambda c: c.position):
            if card.archived_at is not None:
                continue
            card_ids.append(str(card.id))
            cards[str(card.id)] = _serialize_card(card)
        columns.append({"id": str(col.id), "title": col.title, "cardIds": card_ids})
    return {"id": str(board.id), "name": board.name, "columns": columns, "cards": cards}


@router.get("")
def list_boards(user: User = Depends(require_user), db: Session = Depends(get_db)):
    owned = db.query(Board).filter_by(user_id=user.id).order_by(Board.id).all()
    shared = (
        db.query(Board)
        .join(BoardMembership, BoardMembership.board_id == Board.id)
        .filter(BoardMembership.user_id == user.id)
        .order_by(Board.id)
        .all()
    )
    out = [_board_summary(b, role="owner") for b in owned]
    for b in shared:
        role = next((m.role for m in b.memberships if m.user_id == user.id), "viewer")
        out.append(_board_summary(b, role=role))
    return {"boards": out}


@router.post("")
def create_board(
    body: CreateBoardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = Board(user_id=user.id, name=body.name.strip())
    db.add(board)
    db.flush()
    for i, title in enumerate(DEFAULT_COLUMNS):
        db.add(KanbanColumn(board_id=board.id, title=title, position=i))
    db.commit()
    db.refresh(board)
    return _board_full(board)


@router.get("/{board_id}")
def read_board(
    board_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    return _board_full(get_readable_board(board_id, user, db))


@router.post("/{board_id}/rename")
def rename_board(
    board_id: int,
    body: RenameBoardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
    board.name = body.name.strip()
    db.commit()
    return _board_summary(board)


@router.delete("/{board_id}")
def delete_board(
    board_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
    remaining = db.query(Board).filter_by(user_id=user.id).count()
    if remaining <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete your only board")
    db.delete(board)
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/columns")
def add_column(
    board_id: int,
    body: AddColumnBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    max_pos = max((c.position for c in board.columns), default=-1)
    col = KanbanColumn(board_id=board.id, title=body.title.strip(), position=max_pos + 1)
    db.add(col)
    db.commit()
    db.refresh(col)
    return {"id": str(col.id), "title": col.title, "cardIds": []}


@router.delete("/{board_id}/columns/{col_id}")
def delete_column(
    board_id: int,
    col_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    col = db.query(KanbanColumn).filter_by(id=col_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    if len(board.columns) <= 1:
        raise HTTPException(status_code=400, detail="A board must have at least one column")
    db.delete(col)
    db.flush()
    # Compact positions
    remaining = (
        db.query(KanbanColumn)
        .filter_by(board_id=board.id)
        .order_by(KanbanColumn.position)
        .all()
    )
    for i, c in enumerate(remaining):
        c.position = i
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/columns/reorder")
def reorder_columns(
    board_id: int,
    body: ReorderColumnsBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    existing_ids = {c.id for c in board.columns}
    submitted_ids = list(body.column_ids)
    if set(submitted_ids) != existing_ids or len(submitted_ids) != len(existing_ids):
        raise HTTPException(
            status_code=400,
            detail="column_ids must be a complete permutation of the board's columns",
        )
    by_id = {c.id: c for c in board.columns}
    for i, cid in enumerate(submitted_ids):
        by_id[cid].position = i
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/columns/{col_id}/rename")
def rename_column(
    board_id: int,
    col_id: int,
    body: RenameColumnBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    col = db.query(KanbanColumn).filter_by(id=col_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    col.title = body.title.strip()
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/cards")
def create_card(
    board_id: int,
    body: CreateCardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
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


@router.post("/{board_id}/cards/{card_id}")
def update_card(
    board_id: int,
    card_id: int,
    body: UpdateCardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
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
    if body.title is not None:
        card.title = body.title.strip()
    if body.details is not None:
        card.details = body.details
    if body.priority is not None:
        card.priority = body.priority
    if body.clear_due_date:
        card.due_date = None
    elif body.due_date is not None:
        card.due_date = body.due_date
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


def _find_card(db: Session, board: Board, card_id: int, *, archived: bool) -> KanbanCard | None:
    archive_filter = (
        KanbanCard.archived_at.is_not(None) if archived else KanbanCard.archived_at.is_(None)
    )
    return (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(
            KanbanCard.id == card_id,
            KanbanColumn.board_id == board.id,
            archive_filter,
        )
        .first()
    )


def get_active_card_on_board(
    board_id: int, card_id: int, user: User, db: Session, *, writable: bool
) -> KanbanCard:
    """Resolve a non-archived card on a board the user can access, or raise 404."""
    board = (
        get_writable_board(board_id, user, db)
        if writable
        else get_readable_board(board_id, user, db)
    )
    card = _find_card(db, board, card_id, archived=False)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


def _compact_active_positions(db: Session, column_id: int) -> None:
    active = (
        db.query(KanbanCard)
        .filter(KanbanCard.column_id == column_id, KanbanCard.archived_at.is_(None))
        .order_by(KanbanCard.position)
        .all()
    )
    for i, c in enumerate(active):
        c.position = i


def _move_card_within_board(
    db: Session, board: Board, card_id: int, target_column_id: int, position: int
) -> None:
    """Move `card_id` to `target_column_id` at `position`, raising 404 if not found.

    Compacts the source column when crossing columns and renumbers the target
    column so positions stay contiguous.
    """
    card = _find_card(db, board, card_id, archived=False)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    target_col = db.query(KanbanColumn).filter_by(id=target_column_id, board_id=board.id).first()
    if not target_col:
        raise HTTPException(status_code=404, detail="Column not found")

    old_col_id = card.column_id
    card.column_id = target_col.id
    db.flush()

    if old_col_id != target_col.id:
        _compact_active_positions(db, old_col_id)
        db.flush()

    other_cards = (
        db.query(KanbanCard)
        .filter(
            KanbanCard.column_id == target_col.id,
            KanbanCard.id != card_id,
            KanbanCard.archived_at.is_(None),
        )
        .order_by(KanbanCard.position)
        .all()
    )
    new_pos = max(0, min(position, len(other_cards)))
    other_cards.insert(new_pos, card)
    for i, c in enumerate(other_cards):
        c.position = i


@router.delete("/{board_id}/cards/{card_id}")
def archive_card(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Soft-delete a card. The row stays in the DB with archived_at set; the card
    disappears from board responses but can be restored or purged later."""
    board = get_writable_board(board_id, user, db)
    card = _find_card(db, board, card_id, archived=False)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col_id = card.column_id
    card.archived_at = datetime.now(timezone.utc)
    db.flush()
    _compact_active_positions(db, col_id)
    db.commit()
    return {"ok": True}


@router.get("/{board_id}/archive")
def list_archived_cards(
    board_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_readable_board(board_id, user, db)
    cards = (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(KanbanColumn.board_id == board.id, KanbanCard.archived_at.is_not(None))
        .order_by(KanbanCard.archived_at.desc())
        .all()
    )
    out = []
    for c in cards:
        item = _serialize_card(c)
        item["archived_at"] = c.archived_at.isoformat() if c.archived_at else None
        item["column_id"] = str(c.column_id)
        item["column_title"] = c.column.title if c.column else ""
        out.append(item)
    return {"cards": out}


@router.post("/{board_id}/cards/{card_id}/restore")
def restore_card(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    card = _find_card(db, board, card_id, archived=True)
    if not card:
        raise HTTPException(status_code=404, detail="Archived card not found")
    # Restore at the end of the active list in the original column. If the
    # column no longer exists (e.g. deleted while card was archived), restore
    # into the first column on the board.
    col = db.query(KanbanColumn).filter_by(id=card.column_id, board_id=board.id).first()
    if not col:
        col = sorted(board.columns, key=lambda c: c.position)[0] if board.columns else None
        if col is None:
            raise HTTPException(status_code=409, detail="Board has no columns to restore into")
        card.column_id = col.id
    max_pos = max(
        (c.position for c in col.cards if c.archived_at is None and c.id != card.id),
        default=-1,
    )
    card.position = max_pos + 1
    card.archived_at = None
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.delete("/{board_id}/archive/{card_id}")
def purge_card(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Permanently delete an archived card. Comments cascade with the row."""
    board = get_writable_board(board_id, user, db)
    card = _find_card(db, board, card_id, archived=True)
    if not card:
        raise HTTPException(status_code=404, detail="Archived card not found")
    db.delete(card)
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/cards/{card_id}/move")
def move_card(
    board_id: int,
    card_id: int,
    body: MoveCardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    _move_card_within_board(db, board, card_id, body.column_id, body.position)
    db.commit()
    return {"ok": True}
