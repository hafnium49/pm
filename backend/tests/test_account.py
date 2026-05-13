"""Account self-service: change_password / change_username / delete_account."""
from fastapi.testclient import TestClient

from backend.main import app


def _register(client, name, password="supersecret"):
    r = client.post("/api/auth/register", json={"username": name, "password": password})
    assert r.status_code == 200
    return r


# ---------- auth required ----------

def test_change_password_unauthorized(client):
    r = client.post(
        "/api/auth/change_password",
        json={"current_password": "x", "new_password": "supersecret"},
    )
    assert r.status_code == 401


def test_change_username_unauthorized(client):
    r = client.post(
        "/api/auth/change_username",
        json={"password": "x", "new_username": "newname"},
    )
    assert r.status_code == 401


def test_delete_account_unauthorized(client):
    r = client.request("DELETE", "/api/auth/account", json={"password": "x"})
    assert r.status_code == 401


# ---------- change_password ----------

def test_change_password_happy_path(client):
    _register(client, "pw_user", "originalpw")
    r = client.post(
        "/api/auth/change_password",
        json={"current_password": "originalpw", "new_password": "anotherpw"},
    )
    assert r.status_code == 200

    # Logout and login with the new password
    client.post("/api/auth/logout")
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "pw_user", "password": "anotherpw"})
    assert r.status_code == 200
    # Old password no longer works
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "pw_user", "password": "originalpw"})
    assert r.status_code == 401


def test_change_password_wrong_current_rejected(client):
    _register(client, "pw_wrong", "rightpw1")
    r = client.post(
        "/api/auth/change_password",
        json={"current_password": "wrong", "new_password": "newpw1234"},
    )
    assert r.status_code == 401


def test_change_password_too_short_rejected(client):
    _register(client, "pw_short", "originalpw")
    r = client.post(
        "/api/auth/change_password",
        json={"current_password": "originalpw", "new_password": "short"},
    )
    assert r.status_code == 422


def test_change_password_keeps_session_alive(client):
    _register(client, "pw_keep", "originalpw")
    r = client.post(
        "/api/auth/change_password",
        json={"current_password": "originalpw", "new_password": "anotherpw"},
    )
    assert r.status_code == 200
    # /me still works
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "pw_keep"


# ---------- change_username ----------

def test_change_username_happy_path(client):
    _register(client, "old_name", "supersecret")
    r = client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "new_name"},
    )
    assert r.status_code == 200
    assert r.json()["username"] == "new_name"
    # /me reflects the new name via re-signed cookie
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "new_name"


def test_change_username_wrong_password_rejected(client):
    _register(client, "uw_alice", "secret123")
    r = client.post(
        "/api/auth/change_username",
        json={"password": "wrong", "new_username": "uw_bob"},
    )
    assert r.status_code == 401


def test_change_username_invalid_username_rejected(client):
    _register(client, "uw_valid", "supersecret")
    r = client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "no spaces!"},
    )
    assert r.status_code == 400


def test_change_username_too_short_rejected_by_pydantic(client):
    _register(client, "uw_short", "supersecret")
    r = client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "ab"},
    )
    assert r.status_code == 422


def test_change_username_duplicate_rejected(client):
    _register(client, "uw_one", "supersecret")
    client.cookies.clear()
    _register(client, "uw_two", "supersecret")
    # Logged in as uw_two; try to change to uw_one
    r = client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "uw_one"},
    )
    assert r.status_code == 409


def test_change_username_same_name_is_noop(client):
    _register(client, "uw_same", "supersecret")
    r = client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "uw_same"},
    )
    assert r.status_code == 200
    assert r.json()["username"] == "uw_same"


def test_change_username_then_login_with_new_name(client):
    _register(client, "before_name", "supersecret")
    client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "after_name"},
    )
    client.post("/api/auth/logout")
    client.cookies.clear()
    r = client.post(
        "/api/auth/login",
        json={"username": "after_name", "password": "supersecret"},
    )
    assert r.status_code == 200


def test_change_username_invalidates_old_login(client):
    _register(client, "before_invalid", "supersecret")
    client.post(
        "/api/auth/change_username",
        json={"password": "supersecret", "new_username": "after_invalid"},
    )
    client.post("/api/auth/logout")
    client.cookies.clear()
    r = client.post(
        "/api/auth/login",
        json={"username": "before_invalid", "password": "supersecret"},
    )
    assert r.status_code == 401


# ---------- delete_account ----------

def test_delete_account_removes_user(client):
    _register(client, "del_user", "supersecret")
    r = client.request("DELETE", "/api/auth/account", json={"password": "supersecret"})
    assert r.status_code == 200
    # Session is gone — /me returns 401
    client.cookies.clear()
    me = client.get("/api/auth/me")
    assert me.status_code == 401
    # Login with old creds fails
    r = client.post(
        "/api/auth/login",
        json={"username": "del_user", "password": "supersecret"},
    )
    assert r.status_code == 401


def test_delete_account_wrong_password_rejected(client):
    _register(client, "del_wrong", "supersecret")
    r = client.request("DELETE", "/api/auth/account", json={"password": "wrong"})
    assert r.status_code == 401
    # Account still intact — /me works
    me = client.get("/api/auth/me")
    assert me.status_code == 200


def test_delete_account_cascades_boards_and_cards(client):
    """Deleting a user wipes their boards, columns, cards, comments, labels."""
    from backend.database import get_db
    from backend.main import app as fastapi_app
    from backend.models import Board, KanbanCard, KanbanColumn, User

    _register(client, "cascade_user", "supersecret")
    bid = client.get("/api/boards").json()["boards"][0]["id"]
    col_id = int(client.get(f"/api/boards/{bid}").json()["columns"][0]["id"])
    client.post(f"/api/boards/{bid}/cards", json={"column_id": col_id, "title": "doomed"})

    override = fastapi_app.dependency_overrides[get_db]
    gen = override()
    db = next(gen)
    try:
        user = db.query(User).filter_by(username="cascade_user").first()
        assert user is not None
        user_id = user.id
    finally:
        gen.close()

    r = client.request("DELETE", "/api/auth/account", json={"password": "supersecret"})
    assert r.status_code == 200

    gen = override()
    db = next(gen)
    try:
        assert db.query(User).filter_by(id=user_id).first() is None
        assert db.query(Board).filter_by(user_id=user_id).count() == 0
    finally:
        gen.close()


def test_delete_account_does_not_affect_other_users(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "iso_alice")
    _register(bob, "iso_bob")
    # Alice deletes her account
    r = alice.request("DELETE", "/api/auth/account", json={"password": "supersecret"})
    assert r.status_code == 200
    # Bob can still operate normally
    assert bob.get("/api/auth/me").status_code == 200
    assert bob.get("/api/boards").status_code == 200
