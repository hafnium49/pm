from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth import require_auth
from backend.database import get_db
from backend.deps import get_board
from backend.models import KanbanCard, KanbanColumn

router = APIRouter()


class RenameBody(BaseModel):
    title: str


class CreateCardBody(BaseModel):
    column_id: int
    title: str
    details: str = ""


class MoveCardBody(BaseModel):
    column_id: int
    position: int


@router.get("/api/board")
def read_board(
    username: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    board = get_board(username, db)
    columns = []
    cards = {}
    for col in sorted(board.columns, key=lambda c: c.position):
        card_ids = []
        for card in sorted(col.cards, key=lambda c: c.position):
            card_id = str(card.id)
            card_ids.append(card_id)
            cards[card_id] = {"id": card_id, "title": card.title, "details": card.details}
        columns.append({"id": str(col.id), "title": col.title, "cardIds": card_ids})
    return {"columns": columns, "cards": cards}


@router.post("/api/board/columns/{col_id}/rename")
def rename_column(
    col_id: int,
    body: RenameBody,
    username: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    board = get_board(username, db)
    col = db.query(KanbanColumn).filter_by(id=col_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    col.title = body.title
    db.commit()
    return {"ok": True}


@router.post("/api/board/cards")
def create_card(
    body: CreateCardBody,
    username: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    board = get_board(username, db)
    col = db.query(KanbanColumn).filter_by(id=body.column_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    max_pos = max((c.position for c in col.cards), default=-1)
    card = KanbanCard(
        column_id=col.id,
        title=body.title,
        details=body.details,
        position=max_pos + 1,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return {"id": str(card.id), "title": card.title, "details": card.details}


@router.delete("/api/board/cards/{card_id}")
def delete_card(
    card_id: int,
    username: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    board = get_board(username, db)
    card = (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(KanbanCard.id == card_id, KanbanColumn.board_id == board.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col_id = card.column_id
    db.delete(card)
    db.flush()
    remaining = (
        db.query(KanbanCard)
        .filter_by(column_id=col_id)
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
    username: str = Depends(require_auth),
    db: Session = Depends(get_db),
):
    board = get_board(username, db)
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
