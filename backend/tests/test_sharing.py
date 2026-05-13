"""Board sharing / collaborators / role-based access tests."""
from fastapi.testclient import TestClient

from backend.main import app


def _register(client, name, password="supersecret"):
    r = client.post("/api/auth/register", json={"username": name, "password": password})
    assert r.status_code == 200
    return r


def _first_board_id(client):
    return client.get("/api/boards").json()["boards"][0]["id"]


def _first_col(client, board_id):
    return int(client.get(f"/api/boards/{board_id}").json()["columns"][0]["id"])


def _new_card(client, board_id, title="X"):
    col = _first_col(client, board_id)
    r = client.post(f"/api/boards/{board_id}/cards", json={"column_id": col, "title": title})
    return r


def _make_pair(role="editor"):
    """Owner alice invites bob with given role; returns (alice, bob, board_id)."""
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "alice")
    _register(bob, "bob")
    bid = _first_board_id(alice)
    r = alice.post(f"/api/boards/{bid}/members", json={"username": "bob", "role": role})
    assert r.status_code == 200, r.text
    return alice, bob, bid


# ---------- auth ----------

def test_members_list_unauthorized(client):
    r = client.get("/api/boards/1/members")
    assert r.status_code == 401


def test_members_invite_unauthorized(client):
    r = client.post("/api/boards/1/members", json={"username": "x", "role": "editor"})
    assert r.status_code == 401


def test_members_remove_unauthorized(client):
    r = client.delete("/api/boards/1/members/1")
    assert r.status_code == 401


# ---------- list members ----------

def test_list_members_just_owner_initially(authed_client):
    bid = _first_board_id(authed_client)
    r = authed_client.get(f"/api/boards/{bid}/members")
    assert r.status_code == 200
    members = r.json()["members"]
    assert len(members) == 1
    assert members[0]["username"] == "user"
    assert members[0]["role"] == "owner"
    assert members[0]["is_owner"] is True


def test_collaborator_can_list_members(client):
    alice, bob, bid = _make_pair("viewer")
    r = bob.get(f"/api/boards/{bid}/members")
    assert r.status_code == 200
    members = r.json()["members"]
    assert {(m["username"], m["role"]) for m in members} == {("alice", "owner"), ("bob", "viewer")}


def test_non_member_cannot_list_members(client):
    alice = TestClient(app)
    eve = TestClient(app)
    _register(alice, "share_alice")
    _register(eve, "share_eve")
    bid = _first_board_id(alice)
    r = eve.get(f"/api/boards/{bid}/members")
    assert r.status_code == 404


# ---------- invite ----------

def test_invite_user_as_editor(client):
    alice, bob, bid = _make_pair("editor")
    r = bob.get(f"/api/boards/{bid}")
    assert r.status_code == 200
    # Bob can see this board in their listing
    boards = bob.get("/api/boards").json()["boards"]
    assert any(b["id"] == bid and b["role"] == "editor" for b in boards)


def test_invite_unknown_username_404(authed_client):
    bid = _first_board_id(authed_client)
    r = authed_client.post(
        f"/api/boards/{bid}/members",
        json={"username": "nobody-here", "role": "editor"},
    )
    assert r.status_code == 404


def test_invite_yourself_rejected(authed_client):
    bid = _first_board_id(authed_client)
    r = authed_client.post(
        f"/api/boards/{bid}/members",
        json={"username": "user", "role": "editor"},
    )
    assert r.status_code == 400


def test_invite_duplicate_rejected(client):
    alice, bob, bid = _make_pair("editor")
    r = alice.post(f"/api/boards/{bid}/members", json={"username": "bob", "role": "viewer"})
    assert r.status_code == 409


def test_invite_invalid_role_rejected(client):
    alice = TestClient(app)
    _register(alice, "inv_alice")
    _register(alice, "inv_bob")
    alice.cookies.clear()
    alice.post("/api/auth/login", json={"username": "inv_alice", "password": "supersecret"})
    bid = _first_board_id(alice)
    r = alice.post(f"/api/boards/{bid}/members", json={"username": "inv_bob", "role": "queen"})
    assert r.status_code == 422


def test_non_owner_cannot_invite(client):
    alice, bob, bid = _make_pair("editor")
    carol = TestClient(app)
    _register(carol, "carol")
    r = bob.post(f"/api/boards/{bid}/members", json={"username": "carol", "role": "viewer"})
    assert r.status_code == 403


# ---------- role enforcement ----------

def test_editor_can_create_card(client):
    alice, bob, bid = _make_pair("editor")
    r = _new_card(bob, bid, title="bob added")
    assert r.status_code == 200


def test_viewer_cannot_create_card(client):
    alice, bob, bid = _make_pair("viewer")
    r = _new_card(bob, bid, title="bob tries")
    assert r.status_code == 403


def test_viewer_can_read_board(client):
    alice, bob, bid = _make_pair("viewer")
    r = bob.get(f"/api/boards/{bid}")
    assert r.status_code == 200


def test_viewer_can_read_archive(client):
    alice, bob, bid = _make_pair("viewer")
    r = bob.get(f"/api/boards/{bid}/archive")
    assert r.status_code == 200


def test_editor_cannot_rename_board(client):
    alice, bob, bid = _make_pair("editor")
    r = bob.post(f"/api/boards/{bid}/rename", json={"name": "hijacked"})
    assert r.status_code == 403


def test_editor_cannot_delete_board(client):
    alice, bob, bid = _make_pair("editor")
    r = bob.request("DELETE", f"/api/boards/{bid}")
    assert r.status_code == 403


def test_editor_cannot_invite_members(client):
    alice, bob, bid = _make_pair("editor")
    carol = TestClient(app)
    _register(carol, "rea_carol")
    r = bob.post(f"/api/boards/{bid}/members", json={"username": "rea_carol", "role": "viewer"})
    assert r.status_code == 403


def test_editor_can_archive_and_restore(client):
    alice, bob, bid = _make_pair("editor")
    card = _new_card(bob, bid).json()
    assert bob.delete(f"/api/boards/{bid}/cards/{card['id']}").status_code == 200
    assert bob.post(f"/api/boards/{bid}/cards/{card['id']}/restore").status_code == 200


def test_viewer_cannot_archive(client):
    alice, bob, bid = _make_pair("viewer")
    # Owner adds a card; viewer tries to archive
    card = _new_card(alice, bid).json()
    r = bob.delete(f"/api/boards/{bid}/cards/{card['id']}")
    assert r.status_code == 403


def test_editor_can_manage_labels(client):
    alice, bob, bid = _make_pair("editor")
    r = bob.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"})
    assert r.status_code == 200


def test_viewer_cannot_create_label(client):
    alice, bob, bid = _make_pair("viewer")
    r = bob.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"})
    assert r.status_code == 403


def test_viewer_cannot_comment(client):
    alice, bob, bid = _make_pair("viewer")
    card = _new_card(alice, bid).json()
    r = bob.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "hi from viewer"},
    )
    assert r.status_code == 403


def test_editor_can_comment(client):
    alice, bob, bid = _make_pair("editor")
    card = _new_card(alice, bid).json()
    r = bob.post(
        f"/api/boards/{bid}/cards/{card['id']}/comments",
        json={"body": "hi from editor"},
    )
    assert r.status_code == 200
    assert r.json()["author_username"] == "bob"


# ---------- role change ----------

def test_owner_can_change_member_role(client):
    alice, bob, bid = _make_pair("viewer")
    r = alice.post(f"/api/boards/{bid}/members/{int(_user_id(alice, 'bob'))}", json={"role": "editor"})
    assert r.status_code == 200
    # Now bob can create a card
    assert _new_card(bob, bid).status_code == 200


def _user_id(client, username):
    r = client.get(f"/api/boards/{_first_board_id(client)}/members").json()
    for m in r["members"]:
        if m["username"] == username:
            return m["user_id"]
    raise AssertionError(f"User {username} not found in members")


def test_cannot_change_owner_role(client):
    alice, bob, bid = _make_pair("editor")
    alice_id = _user_id(alice, "alice")
    r = alice.post(f"/api/boards/{bid}/members/{alice_id}", json={"role": "viewer"})
    assert r.status_code == 400


def test_non_owner_cannot_change_roles(client):
    alice, bob, bid = _make_pair("editor")
    carol = TestClient(app)
    _register(carol, "rc_carol")
    alice.post(f"/api/boards/{bid}/members", json={"username": "rc_carol", "role": "viewer"})
    carol_id = _user_id(alice, "rc_carol")
    r = bob.post(f"/api/boards/{bid}/members/{carol_id}", json={"role": "editor"})
    assert r.status_code == 403


# ---------- remove / leave ----------

def test_owner_can_remove_member(client):
    alice, bob, bid = _make_pair("editor")
    bob_id = _user_id(alice, "bob")
    r = alice.delete(f"/api/boards/{bid}/members/{bob_id}")
    assert r.status_code == 200
    # Bob no longer sees the board
    assert all(b["id"] != bid for b in bob.get("/api/boards").json()["boards"])


def test_member_can_leave_themself(client):
    alice, bob, bid = _make_pair("editor")
    bob_id = _user_id(alice, "bob")
    r = bob.delete(f"/api/boards/{bid}/members/{bob_id}")
    assert r.status_code == 200


def test_non_owner_cannot_remove_others(client):
    alice, bob, bid = _make_pair("editor")
    carol = TestClient(app)
    _register(carol, "rm_carol")
    alice.post(f"/api/boards/{bid}/members", json={"username": "rm_carol", "role": "editor"})
    carol_id = _user_id(alice, "rm_carol")
    r = bob.delete(f"/api/boards/{bid}/members/{carol_id}")
    assert r.status_code == 403


def test_owner_cannot_be_removed(client):
    alice, bob, bid = _make_pair("editor")
    alice_id = _user_id(alice, "alice")
    r = alice.delete(f"/api/boards/{bid}/members/{alice_id}")
    assert r.status_code == 400


# ---------- list_boards includes shared ----------

def test_list_boards_includes_shared_with_role(client):
    alice, bob, bid = _make_pair("editor")
    bob_boards = bob.get("/api/boards").json()["boards"]
    shared = [b for b in bob_boards if b["id"] == bid]
    assert len(shared) == 1
    assert shared[0]["role"] == "editor"


def test_list_boards_owner_role_field(authed_client):
    boards = authed_client.get("/api/boards").json()["boards"]
    assert all(b["role"] == "owner" for b in boards)
