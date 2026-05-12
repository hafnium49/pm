from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.models import Board, User


def get_default_board(user: User, db: Session) -> Board:
    """Return the user's oldest board (the back-compat default for /api/board)."""
    board = (
        db.query(Board)
        .filter_by(user_id=user.id)
        .order_by(Board.id)
        .first()
    )
    if not board:
        raise HTTPException(status_code=404, detail="No board found for user")
    return board


def get_owned_board(board_id: int, user: User, db: Session) -> Board:
    """Return a board only if it belongs to the user; 404 otherwise."""
    board = db.query(Board).filter_by(id=board_id, user_id=user.id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


# Back-compat alias used by existing tests and routers
def get_board(username: str, db: Session) -> Board:
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return get_default_board(user, db)
