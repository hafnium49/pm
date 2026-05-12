"""Comment CRUD + author-only delete + isolation."""
from fastapi.testclient import TestClient

from backend.main import app


def _default_board_id(client):
    return client.get("/api/boards").json()["boards"][0]["id"]


def _first_col_id(client, board_id):
    return int(client.get(f"/api/boards/{board_id}").json()["columns"][0]["id"])


def _new_card(client, board_id, title="X"):
    col = _first_col_id(client, board_id)
    r = client.post(f"/api/boards/{board_id}/cards", json={"column_id": col, "title": title})
    assert r.status_code == 200
    return r.json()


# ---------- auth required ----------

def test_list_comments_unauthorized(client):
    r = client.get("/api/boards/1/cards/1/comments")
    assert r.status_code == 401


def test_create_comment_unauthorized(client):
    r = client.post("/api/boards/1/cards/1/comments", json={"body": "x"})
    assert r.status_code == 401


def test_delete_comment_unauthorized(client):
    r = client.delete("/api/boards/1/cards/1/comments/1")
    assert r.status_code == 401


# ---------- happy path ----------

def test_list_comments_initially_empty(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/comments")
    assert r.status_code == 200
    assert r.json() == {"comments": []}


def test_create_comment(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "first thought"},
    )
    assert r.status_code == 200
    out = r.json()
    assert out["body"] == "first thought"
    assert out["author_username"] == "user"
    assert out["created_at"] is not None

    listed = authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/comments").json()["comments"]
    assert len(listed) == 1
    assert listed[0]["body"] == "first thought"


def test_create_multiple_comments_orders_by_creation(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    for i in range(3):
        r = authed_client.post(
            f"/api/boards/{bid}/cards/{card['id']}/comments",
            json={"body": f"#{i}"},
        )
        assert r.status_code == 200
    listed = authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/comments").json()["comments"]
    assert [c["body"] for c in listed] == ["#0", "#1", "#2"]


def test_create_comment_trims_body(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "   hello world   "},
    )
    assert r.status_code == 200
    assert r.json()["body"] == "hello world"


def test_create_comment_rejects_empty(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": ""},
    )
    assert r.status_code == 422


def test_create_comment_rejects_overlong(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "x" * 4001},
    )
    assert r.status_code == 422


def test_comment_404_on_unknown_card(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/99999/comments",
        json={"body": "x"},
    )
    assert r.status_code == 404


# ---------- delete rules ----------

def test_author_can_delete_own_comment(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    comment = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "trash me"},
    ).json()
    r = authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}/comments/{comment['id']}")
    assert r.status_code == 200
    assert authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/comments").json()["comments"] == []


def test_delete_404_for_unknown_comment(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}/comments/99999")
    assert r.status_code == 404


# ---------- isolation ----------

def _register(client, name):
    r = client.post("/api/auth/register", json={"username": name, "password": "supersecret"})
    assert r.status_code == 200


def test_user_cannot_list_comments_on_other_users_board(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "cm_alice")
    _register(bob, "cm_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_card = _new_card(alice, a_bid)
    r = bob.get(f"/api/boards/{a_bid}/cards/{a_card['id']}/comments")
    assert r.status_code == 404


def test_user_cannot_post_comment_on_other_users_card(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "cm2_alice")
    _register(bob, "cm2_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_card = _new_card(alice, a_bid)
    r = bob.post(
        f"/api/boards/{a_bid}/cards/{a_card['id']}/comments",
        json={"body": "evil"},
    )
    assert r.status_code == 404


# ---------- comment_count on card payload ----------

def test_card_payload_includes_comment_count(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    board = authed_client.get(f"/api/boards/{bid}").json()
    assert board["cards"][card["id"]]["comment_count"] == 0

    authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "a"},
    )
    authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "b"},
    )
    refreshed = authed_client.get(f"/api/boards/{bid}").json()
    assert refreshed["cards"][card["id"]]["comment_count"] == 2


def test_deleting_card_cascades_to_comments(authed_client):
    """When the card is deleted, the comment row is removed too — checked via the dep-overridden DB."""
    from backend.database import get_db
    from backend.main import app
    from backend.models import Comment

    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    comment = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "doomed"},
    ).json()

    # Re-use the test's session factory (the one tied to in-memory DB)
    override = app.dependency_overrides[get_db]
    gen = override()
    db = next(gen)
    try:
        assert db.query(Comment).filter_by(id=int(comment["id"])).first() is not None
    finally:
        gen.close()

    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    r = authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/comments")
    assert r.status_code == 404

    gen = override()
    db = next(gen)
    try:
        assert db.query(Comment).filter_by(id=int(comment["id"])).first() is None
    finally:
        gen.close()
