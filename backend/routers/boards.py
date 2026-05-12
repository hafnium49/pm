from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_owned_board
from backend.models import Board, KanbanCard, KanbanColumn, User

router = APIRouter(prefix="/api/boards")

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


class CreateBoardBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class RenameBoardBody(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class RenameColumnBody(BaseModel):
    title: str = Field(min_length=1, max_length=128)


class CreateCardBody(BaseModel):
    column_id: int
    title: str = Field(min_length=1, max_length=256)
    details: str = ""


class MoveCardBody(BaseModel):
    column_id: int
    position: int


def _board_summary(board: Board) -> dict:
    return {
        "id": str(board.id),
        "name": board.name,
        "column_count": len(board.columns),
        "card_count": sum(len(c.cards) for c in board.columns),
    }


def _board_full(board: Board) -> dict:
    columns = []
    cards: dict[str, dict] = {}
    for col in sorted(board.columns, key=lambda c: c.position):
        card_ids = []
        for card in sorted(col.cards, key=lambda c: c.position):
            card_id = str(card.id)
            card_ids.append(card_id)
            cards[card_id] = {"id": card_id, "title": card.title, "details": card.details}
        columns.append({"id": str(col.id), "title": col.title, "cardIds": card_ids})
    return {"id": str(board.id), "name": board.name, "columns": columns, "cards": cards}


@router.get("")
def list_boards(user: User = Depends(require_user), db: Session = Depends(get_db)):
    boards = db.query(Board).filter_by(user_id=user.id).order_by(Board.id).all()
    return {"boards": [_board_summary(b) for b in boards]}


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
    return _board_full(get_owned_board(board_id, user, db))


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


@router.post("/{board_id}/columns/{col_id}/rename")
def rename_column(
    board_id: int,
    col_id: int,
    body: RenameColumnBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
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
    board = get_owned_board(board_id, user, db)
    col = db.query(KanbanColumn).filter_by(id=body.column_id, board_id=board.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    max_pos = max((c.position for c in col.cards), default=-1)
    card = KanbanCard(
        column_id=col.id,
        title=body.title.strip(),
        details=body.details,
        position=max_pos + 1,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return {"id": str(card.id), "title": card.title, "details": card.details}


@router.delete("/{board_id}/cards/{card_id}")
def delete_card(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
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


@router.post("/{board_id}/cards/{card_id}/move")
def move_card(
    board_id: int,
    card_id: int,
    body: MoveCardBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    board = get_owned_board(board_id, user, db)
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
