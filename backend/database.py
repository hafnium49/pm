import os
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, Session

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DATA_DIR}/kanban.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


# Lightweight migrations for SQLite. Each entry is (table, column, ddl_clause).
# These run idempotently after create_all to upgrade pre-existing dev databases.
_PENDING_MIGRATIONS: list[tuple[str, str, str]] = [
    ("cards", "priority", "VARCHAR NOT NULL DEFAULT 'medium'"),
    ("cards", "due_date", "DATE"),
]


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _apply_sqlite_migrations() -> None:
    inspector = inspect(engine)
    if "cards" not in inspector.get_table_names():
        return
    with engine.begin() as conn:
        for table, column, clause in _PENDING_MIGRATIONS:
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {clause}"))


def create_tables() -> None:
    from backend.models import Base
    os.makedirs(DATA_DIR, exist_ok=True)
    Base.metadata.create_all(engine)
    _apply_sqlite_migrations()
