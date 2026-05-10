import hashlib

from sqlalchemy.orm import Session

from backend.models import User, Board, KanbanColumn

DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


def seed_db(db: Session) -> None:
    if db.query(User).filter_by(username="user").first():
        return
    hashed = hashlib.sha256(b"password").hexdigest()
    user = User(username="user", hashed_password=hashed)
    db.add(user)
    db.flush()
    board = Board(user_id=user.id, name="My Board")
    db.add(board)
    db.flush()
    for i, title in enumerate(DEFAULT_COLUMNS):
        db.add(KanbanColumn(board_id=board.id, title=title, position=i))
    db.commit()
