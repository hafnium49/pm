from sqlalchemy.orm import Session

from backend.models import Board, KanbanColumn, User
from backend.security import hash_password

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def create_default_board(user: User, db: Session) -> Board:
    """Create a 'My Board' with the standard five columns for the given user."""
    board = Board(user_id=user.id, name="My Board")
    db.add(board)
    db.flush()
    for i, title in enumerate(DEFAULT_COLUMNS):
        db.add(KanbanColumn(board_id=board.id, title=title, position=i))
    db.flush()
    return board


def seed_db(db: Session) -> None:
    user = db.query(User).filter_by(username="user").first()
    if user is None:
        user = User(username="user", hashed_password=hash_password("password"))
        db.add(user)
        db.flush()
    if not user.boards:
        create_default_board(user, db)
    db.commit()
