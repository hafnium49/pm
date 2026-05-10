import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import get_db
from backend.main import app
from backend.models import Base
from backend.seed import seed_db


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine)
    with TestSession() as db:
        seed_db(db)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


def _login(client):
    client.post("/api/auth/login", json={"username": "user", "password": "password"})


# --- unauthenticated ---

def test_get_board_unauthenticated(client):
    r = client.get("/api/board")
    assert r.status_code == 401


def test_rename_column_unauthenticated(client):
    r = client.post("/api/board/columns/1/rename", json={"title": "x"})
    assert r.status_code == 401


def test_create_card_unauthenticated(client):
    r = client.post("/api/board/cards", json={"column_id": 1, "title": "x", "details": ""})
    assert r.status_code == 401


def test_delete_card_unauthenticated(client):
    r = client.delete("/api/board/cards/1")
    assert r.status_code == 401


def test_move_card_unauthenticated(client):
    r = client.post("/api/board/cards/1/move", json={"column_id": 1, "position": 0})
    assert r.status_code == 401


# --- authenticated happy paths ---

def test_get_board(client):
    _login(client)
    r = client.get("/api/board")
    assert r.status_code == 200
    data = r.json()
    assert len(data["columns"]) == 5
    assert data["columns"][0]["title"] == "Backlog"
    assert isinstance(data["cards"], dict)


def test_rename_column(client):
    _login(client)
    board = client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    r = client.post(f"/api/board/columns/{col_id}/rename", json={"title": "Todo"})
    assert r.status_code == 200
    board2 = client.get("/api/board").json()
    assert board2["columns"][0]["title"] == "Todo"


def test_rename_column_not_found(client):
    _login(client)
    r = client.post("/api/board/columns/99999/rename", json={"title": "x"})
    assert r.status_code == 404


def test_create_card(client):
    _login(client)
    board = client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    r = client.post("/api/board/cards", json={"column_id": col_id, "title": "Test card", "details": "Some details"})
    assert r.status_code == 200
    card = r.json()
    assert card["title"] == "Test card"
    board2 = client.get("/api/board").json()
    assert card["id"] in board2["cards"]
    assert card["id"] in board2["columns"][0]["cardIds"]


def test_delete_card(client):
    _login(client)
    board = client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    card = client.post("/api/board/cards", json={"column_id": col_id, "title": "ToDelete", "details": ""}).json()
    r = client.delete(f"/api/board/cards/{card['id']}")
    assert r.status_code == 200
    board2 = client.get("/api/board").json()
    assert card["id"] not in board2["cards"]


def test_delete_card_not_found(client):
    _login(client)
    r = client.delete("/api/board/cards/99999")
    assert r.status_code == 404


def test_move_card_same_column(client):
    _login(client)
    board = client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    c1 = client.post("/api/board/cards", json={"column_id": col_id, "title": "C1", "details": ""}).json()
    c2 = client.post("/api/board/cards", json={"column_id": col_id, "title": "C2", "details": ""}).json()
    r = client.post(f"/api/board/cards/{c2['id']}/move", json={"column_id": col_id, "position": 0})
    assert r.status_code == 200
    board2 = client.get("/api/board").json()
    col_cards = board2["columns"][0]["cardIds"]
    assert col_cards.index(c2["id"]) < col_cards.index(c1["id"])


def test_move_card_different_column(client):
    _login(client)
    board = client.get("/api/board").json()
    col0_id = int(board["columns"][0]["id"])
    col1_id = int(board["columns"][1]["id"])
    card = client.post("/api/board/cards", json={"column_id": col0_id, "title": "ToMove", "details": ""}).json()
    r = client.post(f"/api/board/cards/{card['id']}/move", json={"column_id": col1_id, "position": 0})
    assert r.status_code == 200
    board2 = client.get("/api/board").json()
    assert card["id"] in board2["columns"][1]["cardIds"]
    assert card["id"] not in board2["columns"][0]["cardIds"]


def test_move_card_not_found(client):
    _login(client)
    board = client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    r = client.post("/api/board/cards/99999/move", json={"column_id": col_id, "position": 0})
    assert r.status_code == 404
