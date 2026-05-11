from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.models import Board, User


def get_board(username: str, db: Session) -> Board:
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    board = db.query(Board).filter_by(user_id=user.id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board
