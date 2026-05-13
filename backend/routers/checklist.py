from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_readable_board, get_writable_board
from backend.models import ChecklistItem, KanbanCard, KanbanColumn, User

router = APIRouter(prefix="/api/boards")


class AddItemBody(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class UpdateItemBody(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=1000)
    done: bool | None = None


def _serialize_item(item: ChecklistItem) -> dict:
    return {
        "id": str(item.id),
        "text": item.text,
        "done": bool(item.done),
        "position": item.position,
    }


def _get_card(
    board_id: int, card_id: int, user: User, db: Session, *, writable: bool
) -> KanbanCard:
    board = (
        get_writable_board(board_id, user, db)
        if writable
        else get_readable_board(board_id, user, db)
    )
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
    return card


@router.get("/{board_id}/cards/{card_id}/checklist")
def list_checklist(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card(board_id, card_id, user, db, writable=False)
    return {"items": [_serialize_item(i) for i in card.checklist_items]}


@router.post("/{board_id}/cards/{card_id}/checklist")
def add_checklist_item(
    board_id: int,
    card_id: int,
    body: AddItemBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card(board_id, card_id, user, db, writable=True)
    max_pos = max((i.position for i in card.checklist_items), default=-1)
    item = ChecklistItem(
        card_id=card.id,
        text=body.text.strip(),
        done=False,
        position=max_pos + 1,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_item(item)


@router.post("/{board_id}/cards/{card_id}/checklist/{item_id}")
def update_checklist_item(
    board_id: int,
    card_id: int,
    item_id: int,
    body: UpdateItemBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card(board_id, card_id, user, db, writable=True)
    item = (
        db.query(ChecklistItem)
        .filter_by(id=item_id, card_id=card.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    if body.text is not None:
        item.text = body.text.strip()
    if body.done is not None:
        item.done = body.done
    db.commit()
    db.refresh(item)
    return _serialize_item(item)


@router.delete("/{board_id}/cards/{card_id}/checklist/{item_id}")
def delete_checklist_item(
    board_id: int,
    card_id: int,
    item_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card(board_id, card_id, user, db, writable=True)
    item = (
        db.query(ChecklistItem)
        .filter_by(id=item_id, card_id=card.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    db.delete(item)
    db.flush()
    # Compact positions
    remaining = (
        db.query(ChecklistItem)
        .filter_by(card_id=card.id)
        .order_by(ChecklistItem.position)
        .all()
    )
    for i, x in enumerate(remaining):
        x.position = i
    db.commit()
    return {"ok": True}
