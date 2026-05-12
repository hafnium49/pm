"""Cross-user isolation: user A must never see, mutate, or delete user B's data."""
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
def two_users():
    """Yield (alice_client, bob_client) both logged in against the same backing DB."""
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
    try:
        alice = TestClient(app)
        bob = TestClient(app)
        alice.post("/api/auth/register", json={"username": "alice", "password": "alicepass1"})
        bob.post("/api/auth/register", json={"username": "bob", "password": "bobpass123"})
        yield alice, bob
    finally:
        app.dependency_overrides.clear()


def test_users_see_only_their_own_boards(two_users):
    alice, bob = two_users
    alice.post("/api/boards", json={"name": "Alice Roadmap"})
    bob.post("/api/boards", json={"name": "Bob Roadmap"})

    a_boards = alice.get("/api/boards").json()["boards"]
    b_boards = bob.get("/api/boards").json()["boards"]
    a_names = {b["name"] for b in a_boards}
    b_names = {b["name"] for b in b_boards}
    assert "Alice Roadmap" in a_names
    assert "Alice Roadmap" not in b_names
    assert "Bob Roadmap" in b_names
    assert "Bob Roadmap" not in a_names


def test_user_cannot_read_other_users_board(two_users):
    alice, bob = two_users
    alice_board = alice.post("/api/boards", json={"name": "Secret"}).json()
    bid = alice_board["id"]
    r = bob.get(f"/api/boards/{bid}")
    assert r.status_code == 404


def test_user_cannot_rename_other_users_board(two_users):
    alice, bob = two_users
    alice_board = alice.post("/api/boards", json={"name": "Untouched"}).json()
    bid = alice_board["id"]
    r = bob.post(f"/api/boards/{bid}/rename", json={"name": "hacked"})
    assert r.status_code == 404
    assert alice.get(f"/api/boards/{bid}").json()["name"] == "Untouched"


def test_user_cannot_delete_other_users_board(two_users):
    alice, bob = two_users
    alice_board = alice.post("/api/boards", json={"name": "Mine"}).json()
    bid = alice_board["id"]
    r = bob.delete(f"/api/boards/{bid}")
    assert r.status_code == 404
    assert alice.get(f"/api/boards/{bid}").status_code == 200


def test_user_cannot_create_card_on_other_users_board(two_users):
    alice, bob = two_users
    alice_board = alice.post("/api/boards", json={"name": "Alice"}).json()
    col_id = int(alice_board["columns"][0]["id"])
    r = bob.post(
        f"/api/boards/{alice_board['id']}/cards",
        json={"column_id": col_id, "title": "evil", "details": ""},
    )
    assert r.status_code == 404


def test_user_cannot_delete_or_move_other_users_card(two_users):
    alice, bob = two_users
    alice_board = alice.post("/api/boards", json={"name": "Alice"}).json()
    a_col = int(alice_board["columns"][0]["id"])
    a_card = alice.post(
        f"/api/boards/{alice_board['id']}/cards",
        json={"column_id": a_col, "title": "alice card", "details": ""},
    ).json()

    r = bob.delete(f"/api/boards/{alice_board['id']}/cards/{a_card['id']}")
    assert r.status_code == 404
    r = bob.post(
        f"/api/boards/{alice_board['id']}/cards/{a_card['id']}/move",
        json={"column_id": a_col, "position": 0},
    )
    assert r.status_code == 404

    # Card is still there
    refreshed = alice.get(f"/api/boards/{alice_board['id']}").json()
    assert a_card["id"] in refreshed["cards"]


def test_legacy_board_endpoint_uses_callers_default_board(two_users):
    alice, bob = two_users
    a = alice.get("/api/board").json()
    b = bob.get("/api/board").json()
    # Same structure but different board IDs
    assert a["id"] != b["id"]
    # Alice adds a card via the legacy endpoint
    col = int(a["columns"][0]["id"])
    alice.post("/api/board/cards", json={"column_id": col, "title": "alice via legacy", "details": ""})
    # Bob's default board is unaffected
    b_after = bob.get("/api/board").json()
    assert all(c["title"] != "alice via legacy" for c in b_after["cards"].values())


def test_ai_chat_with_other_users_board_id_404(two_users):
    """AI chat must reject a board_id the caller doesn't own."""
    from unittest.mock import AsyncMock, patch

    alice, bob = two_users
    alice_board = alice.post("/api/boards", json={"name": "Alice"}).json()
    with patch(
        "backend.routers.ai.chat_json",
        new=AsyncMock(return_value={"message": "ok", "board_updates": []}),
    ):
        r = bob.post(
            "/api/ai/chat",
            json={"board_id": int(alice_board["id"]), "messages": [{"role": "user", "content": "hi"}]},
        )
    assert r.status_code == 404
