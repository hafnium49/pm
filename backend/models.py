from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


card_labels = Table(
    "card_labels",
    Base.metadata,
    Column("card_id", Integer, ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    boards = relationship("Board", back_populates="user", cascade="all, delete-orphan")


class Board(Base):
    __tablename__ = "boards"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)

    user = relationship("User", back_populates="boards")
    columns = relationship(
        "KanbanColumn",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="KanbanColumn.position",
    )
    labels = relationship(
        "Label",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="Label.id",
    )


class KanbanColumn(Base):
    __tablename__ = "columns"

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    position = Column(Integer, nullable=False)

    board = relationship("Board", back_populates="columns")
    cards = relationship(
        "KanbanCard",
        back_populates="column",
        cascade="all, delete-orphan",
        order_by="KanbanCard.position",
    )


class KanbanCard(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True)
    column_id = Column(Integer, ForeignKey("columns.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    details = Column(Text, nullable=False, default="")
    position = Column(Integer, nullable=False)
    priority = Column(String, nullable=False, default="medium")
    due_date = Column(Date, nullable=True)

    column = relationship("KanbanColumn", back_populates="cards")
    labels = relationship(
        "Label",
        secondary=card_labels,
        back_populates="cards",
        order_by="Label.id",
    )
    comments = relationship(
        "Comment",
        back_populates="card",
        cascade="all, delete-orphan",
        order_by="Comment.created_at",
    )


class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("board_id", "name", name="uq_label_board_name"),)

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="slate")

    board = relationship("Board", back_populates="labels")
    cards = relationship("KanbanCard", secondary=card_labels, back_populates="labels")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    card = relationship("KanbanCard", back_populates="comments")
    author = relationship("User")
