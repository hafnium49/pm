"""Back-compat single-board API.

These endpoints operate on the user's default (oldest) board so the existing
frontend keeps working unchanged. New code should use /api/boards/{id}/...
"""
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_default_board
from backend.models import KanbanCard, KanbanColumn, User
from backend.routers.boards import (
    _board_full,
    _compact_active_positions,
    _find_card,
    _move_card_within_board,
    _serialize_card,
)

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
    return _board_full(get_default_board(user, db))


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
    board = get_default_board(user, db)
    card = _find_card(db, board, card_id, archived=False)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col_id = card.column_id
    card.archived_at = datetime.now(timezone.utc)
    db.flush()
    _compact_active_positions(db, col_id)
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
    _move_card_within_board(db, board, card_id, body.column_id, body.position)
    db.commit()
    return {"ok": True}
