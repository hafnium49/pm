"""Tests for the richer card model: priority + due_date + update endpoint."""


def _create_card(client, board_id, **kwargs):
    payload = {"column_id": kwargs.pop("column_id"), "title": kwargs.pop("title", "X"), "details": ""}
    payload.update(kwargs)
    r = client.post(f"/api/boards/{board_id}/cards", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def _first_col_id(client, board_id):
    board = client.get(f"/api/boards/{board_id}").json()
    return int(board["columns"][0]["id"])


def _default_board_id(client):
    return client.get("/api/boards").json()["boards"][0]["id"]


# ---------- defaults ----------

def test_default_priority_is_medium_and_due_date_is_null(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    card = _create_card(authed_client, bid, column_id=col, title="Plain")
    assert card["priority"] == "medium"
    assert card["due_date"] is None


def test_legacy_board_returns_priority_and_due_date(authed_client):
    board = authed_client.get("/api/board").json()
    col = int(board["columns"][0]["id"])
    card = authed_client.post("/api/board/cards", json={"column_id": col, "title": "A"}).json()
    assert card["priority"] == "medium"
    assert card["due_date"] is None
    full = authed_client.get("/api/board").json()
    assert full["cards"][card["id"]]["priority"] == "medium"


# ---------- create with details ----------

def test_create_card_with_priority_and_due_date(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    card = _create_card(
        authed_client, bid,
        column_id=col, title="Important",
        priority="high", due_date="2026-09-30",
    )
    assert card["priority"] == "high"
    assert card["due_date"] == "2026-09-30"


def test_create_card_rejects_invalid_priority(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards",
        json={"column_id": col, "title": "X", "priority": "urgent"},
    )
    assert r.status_code == 422


def test_create_card_rejects_invalid_date(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards",
        json={"column_id": col, "title": "X", "due_date": "not-a-date"},
    )
    assert r.status_code == 422


# ---------- update endpoint ----------

def test_update_card_changes_title_details_priority_due(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    card = _create_card(authed_client, bid, column_id=col, title="Start")
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}",
        json={
            "title": "Renamed",
            "details": "fuller description",
            "priority": "high",
            "due_date": "2026-12-31",
        },
    )
    assert r.status_code == 200
    out = r.json()
    assert out["title"] == "Renamed"
    assert out["details"] == "fuller description"
    assert out["priority"] == "high"
    assert out["due_date"] == "2026-12-31"

    # And the board view reflects the changes
    fresh = authed_client.get(f"/api/boards/{bid}").json()
    assert fresh["cards"][card["id"]]["priority"] == "high"


def test_update_card_partial_only_changes_provided_fields(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    card = _create_card(
        authed_client, bid,
        column_id=col, title="Foo", priority="high", due_date="2026-01-01",
    )
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}",
        json={"title": "Bar"},
    )
    assert r.status_code == 200
    out = r.json()
    assert out["title"] == "Bar"
    assert out["priority"] == "high"  # unchanged
    assert out["due_date"] == "2026-01-01"  # unchanged


def test_update_card_clear_due_date(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    card = _create_card(
        authed_client, bid,
        column_id=col, title="dated", due_date="2026-01-01",
    )
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}",
        json={"clear_due_date": True},
    )
    assert r.status_code == 200
    assert r.json()["due_date"] is None


def test_update_card_unauthorized(client):
    r = client.post("/api/boards/1/cards/1", json={"title": "x"})
    assert r.status_code == 401


def test_update_card_404_for_unknown(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(f"/api/boards/{bid}/cards/99999", json={"title": "x"})
    assert r.status_code == 404


def test_update_card_rejects_invalid_priority(authed_client):
    bid = _default_board_id(authed_client)
    col = _first_col_id(authed_client, bid)
    card = _create_card(authed_client, bid, column_id=col, title="X")
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}",
        json={"priority": "urgent"},
    )
    assert r.status_code == 422


def test_user_cannot_update_other_users_card(client):
    """End-to-end isolation: card owned by alice cannot be updated by bob."""
    from fastapi.testclient import TestClient
    from backend.main import app
    alice = TestClient(app)
    bob = TestClient(app)
    # Use the per-test override that `client` set up via conftest
    alice.cookies = client.cookies.__class__()
    bob.cookies = client.cookies.__class__()
    alice.post("/api/auth/register", json={"username": "alice_iso", "password": "supersecret"})
    bob.post("/api/auth/register", json={"username": "bob_iso", "password": "supersecret"})
    boards = alice.get("/api/boards").json()["boards"]
    a_bid = boards[0]["id"]
    a_col = int(alice.get(f"/api/boards/{a_bid}").json()["columns"][0]["id"])
    a_card = alice.post(f"/api/boards/{a_bid}/cards", json={"column_id": a_col, "title": "alice"}).json()
    r = bob.post(f"/api/boards/{a_bid}/cards/{a_card['id']}", json={"title": "hacked"})
    assert r.status_code == 404
    # And alice's card is unchanged
    refreshed = alice.get(f"/api/boards/{a_bid}").json()
    assert refreshed["cards"][a_card["id"]]["title"] == "alice"
