from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.models import Board, BoardMembership, User

Role = Literal["owner", "editor", "viewer"]
ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}


def get_default_board(user: User, db: Session) -> Board:
    """Return the user's oldest owned board (the back-compat default for /api/board)."""
    board = (
        db.query(Board)
        .filter_by(user_id=user.id)
        .order_by(Board.id)
        .first()
    )
    if not board:
        raise HTTPException(status_code=404, detail="No board found for user")
    return board


def effective_role(board: Board, user: User, db: Session) -> Role | None:
    """Return the user's effective role on the board, or None if no access."""
    if board.user_id == user.id:
        return "owner"
    membership = (
        db.query(BoardMembership)
        .filter_by(board_id=board.id, user_id=user.id)
        .first()
    )
    return membership.role if membership else None  # type: ignore[return-value]


def _check(board_id: int, user: User, db: Session, required: Role) -> Board:
    board = db.query(Board).filter_by(id=board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    role = effective_role(board, user, db)
    if role is None:
        raise HTTPException(status_code=404, detail="Board not found")
    if ROLE_RANK[role] < ROLE_RANK[required]:
        raise HTTPException(status_code=403, detail=f"Requires {required} access")
    return board


def get_readable_board(board_id: int, user: User, db: Session) -> Board:
    """Any role (owner/editor/viewer) can read."""
    return _check(board_id, user, db, "viewer")


def get_writable_board(board_id: int, user: User, db: Session) -> Board:
    """Editor and owner can mutate cards/columns/labels/comments."""
    return _check(board_id, user, db, "editor")


def get_owned_board(board_id: int, user: User, db: Session) -> Board:
    """Owner-only: rename/delete board and member management."""
    return _check(board_id, user, db, "owner")
