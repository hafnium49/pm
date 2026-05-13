from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_readable_board, get_writable_board
from backend.models import KanbanCard, KanbanColumn, Label, User

router = APIRouter(prefix="/api/boards")

LabelColor = Literal[
    "slate", "red", "amber", "lime", "emerald", "cyan", "blue", "violet", "fuchsia", "pink",
]


class CreateLabelBody(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    color: LabelColor = "slate"


class UpdateLabelBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    color: LabelColor | None = None


class SetCardLabelsBody(BaseModel):
    label_ids: list[int]


def _serialize_label(label: Label) -> dict:
    return {"id": str(label.id), "name": label.name, "color": label.color}


def _get_writable_label(board_id: int, label_id: int, user: User, db: Session) -> Label:
    board = get_writable_board(board_id, user, db)
    label = db.query(Label).filter_by(id=label_id, board_id=board.id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    return label


@router.get("/{board_id}/labels")
def list_labels(
    board_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_readable_board(board_id, user, db)
    return {"labels": [_serialize_label(label) for label in board.labels]}


@router.post("/{board_id}/labels")
def create_label(
    board_id: int,
    body: CreateLabelBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    label = Label(board_id=board.id, name=body.name.strip(), color=body.color)
    db.add(label)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A label with that name already exists on this board")
    db.refresh(label)
    return _serialize_label(label)


@router.post("/{board_id}/labels/{label_id}")
def update_label(
    board_id: int,
    label_id: int,
    body: UpdateLabelBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    label = _get_writable_label(board_id, label_id, user, db)
    if body.name is not None:
        label.name = body.name.strip()
    if body.color is not None:
        label.color = body.color
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A label with that name already exists on this board")
    db.refresh(label)
    return _serialize_label(label)


@router.delete("/{board_id}/labels/{label_id}")
def delete_label(
    board_id: int,
    label_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    label = _get_writable_label(board_id, label_id, user, db)
    db.delete(label)
    db.commit()
    return {"ok": True}


@router.post("/{board_id}/cards/{card_id}/labels")
def set_card_labels(
    board_id: int,
    card_id: int,
    body: SetCardLabelsBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_writable_board(board_id, user, db)
    card = (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(KanbanCard.id == card_id, KanbanColumn.board_id == board.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    if body.label_ids:
        labels = (
            db.query(Label)
            .filter(Label.id.in_(body.label_ids), Label.board_id == board.id)
            .all()
        )
        if len(labels) != len(set(body.label_ids)):
            raise HTTPException(status_code=404, detail="One or more labels not found on this board")
        card.labels = labels
    else:
        card.labels = []
    db.commit()
    db.refresh(card)
    return {"labels": [_serialize_label(label) for label in card.labels]}
