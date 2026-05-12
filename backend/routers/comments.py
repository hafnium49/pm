from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import require_user
from backend.database import get_db
from backend.deps import get_owned_board
from backend.models import Comment, KanbanCard, KanbanColumn, User

router = APIRouter(prefix="/api/boards")


class CreateCommentBody(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


def _serialize_comment(comment: Comment) -> dict:
    return {
        "id": str(comment.id),
        "body": comment.body,
        "author_id": str(comment.author_id),
        "author_username": comment.author.username if comment.author else "",
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


def _get_card_on_board(board_id: int, card_id: int, user: User, db: Session) -> KanbanCard:
    board = get_owned_board(board_id, user, db)
    card = (
        db.query(KanbanCard)
        .join(KanbanColumn)
        .filter(KanbanCard.id == card_id, KanbanColumn.board_id == board.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("/{board_id}/cards/{card_id}/comments")
def list_comments(
    board_id: int,
    card_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card_on_board(board_id, card_id, user, db)
    return {"comments": [_serialize_comment(c) for c in card.comments]}


@router.post("/{board_id}/cards/{card_id}/comments")
def create_comment(
    board_id: int,
    card_id: int,
    body: CreateCommentBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card_on_board(board_id, card_id, user, db)
    comment = Comment(card_id=card.id, author_id=user.id, body=body.body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    # Eager-load author for serialization
    _ = comment.author
    return _serialize_comment(comment)


@router.delete("/{board_id}/cards/{card_id}/comments/{comment_id}")
def delete_comment(
    board_id: int,
    card_id: int,
    comment_id: int,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    card = _get_card_on_board(board_id, card_id, user, db)
    comment = db.query(Comment).filter_by(id=comment_id, card_id=card.id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Only the comment author can delete it")
    db.delete(comment)
    db.commit()
    return {"ok": True}
