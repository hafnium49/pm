from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.models import ChecklistItem, User
from backend.routers.boards import get_active_card_on_board

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


def _get_item(db: Session, card_id: int, item_id: int) -> ChecklistItem:
    item = db.query(ChecklistItem).filter_by(id=item_id, card_id=card_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


@router.get("/{board_id}/cards/{card_id}/checklist")
def list_checklist(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = get_active_card_on_board(board_id, card_id, user, db, writable=False)
    return {"items": [_serialize_item(i) for i in card.checklist_items]}


@router.post("/{board_id}/cards/{card_id}/checklist")
def add_checklist_item(
    board_id: int,
    card_id: int,
    body: AddItemBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = get_active_card_on_board(board_id, card_id, user, db, writable=True)
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
    card = get_active_card_on_board(board_id, card_id, user, db, writable=True)
    item = _get_item(db, card.id, item_id)
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
    card = get_active_card_on_board(board_id, card_id, user, db, writable=True)
    item = _get_item(db, card.id, item_id)
    db.delete(item)
    db.flush()
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
