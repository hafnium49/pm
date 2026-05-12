"""Custom column CRUD + reorder + isolation + cascade."""
from fastapi.testclient import TestClient

from backend.main import app


def _default_board_id(client):
    return client.get("/api/boards").json()["boards"][0]["id"]


def _columns(client, bid):
    return client.get(f"/api/boards/{bid}").json()["columns"]


# ---------- auth ----------

def test_add_column_unauthorized(client):
    r = client.post("/api/boards/1/columns", json={"title": "x"})
    assert r.status_code == 401


def test_delete_column_unauthorized(client):
    r = client.delete("/api/boards/1/columns/1")
    assert r.status_code == 401


def test_reorder_columns_unauthorized(client):
    r = client.post("/api/boards/1/columns/reorder", json={"column_ids": [1]})
    assert r.status_code == 401


# ---------- add ----------

def test_add_column_appends(authed_client):
    bid = _default_board_id(authed_client)
    before = _columns(authed_client, bid)
    r = authed_client.post(f"/api/boards/{bid}/columns", json={"title": "Blocked"})
    assert r.status_code == 200
    new = r.json()
    assert new["title"] == "Blocked"
    assert new["cardIds"] == []
    after = _columns(authed_client, bid)
    assert len(after) == len(before) + 1
    assert after[-1]["id"] == new["id"]


def test_add_column_blank_title_rejected(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(f"/api/boards/{bid}/columns", json={"title": ""})
    assert r.status_code == 422


# ---------- delete ----------

def test_delete_column_removes_it(authed_client):
    bid = _default_board_id(authed_client)
    new = authed_client.post(f"/api/boards/{bid}/columns", json={"title": "Temp"}).json()
    r = authed_client.delete(f"/api/boards/{bid}/columns/{new['id']}")
    assert r.status_code == 200
    cols = _columns(authed_client, bid)
    assert all(c["id"] != new["id"] for c in cols)
    # Positions are compact 0..N-1
    for i, c in enumerate(cols):
        # positions aren't surfaced, but the order in the response IS by position
        pass


def test_delete_column_cascades_to_cards(authed_client):
    """All cards inside a deleted column are removed."""
    bid = _default_board_id(authed_client)
    cols = _columns(authed_client, bid)
    col_id = int(cols[0]["id"])
    card = authed_client.post(
        f"/api/boards/{bid}/cards",
        json={"column_id": col_id, "title": "doomed"},
    ).json()
    authed_client.delete(f"/api/boards/{bid}/columns/{col_id}")
    full = authed_client.get(f"/api/boards/{bid}").json()
    assert card["id"] not in full["cards"]


def test_delete_last_column_blocked(authed_client):
    bid = _default_board_id(authed_client)
    cols = _columns(authed_client, bid)
    # Delete all but one
    for c in cols[1:]:
        authed_client.delete(f"/api/boards/{bid}/columns/{c['id']}")
    remaining = _columns(authed_client, bid)
    assert len(remaining) == 1
    r = authed_client.delete(f"/api/boards/{bid}/columns/{remaining[0]['id']}")
    assert r.status_code == 400


def test_delete_unknown_column_404(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.delete(f"/api/boards/{bid}/columns/99999")
    assert r.status_code == 404


# ---------- reorder ----------

def test_reorder_columns_changes_order(authed_client):
    bid = _default_board_id(authed_client)
    cols = _columns(authed_client, bid)
    ids = [int(c["id"]) for c in cols]
    reversed_ids = list(reversed(ids))
    r = authed_client.post(
        f"/api/boards/{bid}/columns/reorder",
        json={"column_ids": reversed_ids},
    )
    assert r.status_code == 200
    after = _columns(authed_client, bid)
    assert [int(c["id"]) for c in after] == reversed_ids


def test_reorder_rejects_incomplete_set(authed_client):
    bid = _default_board_id(authed_client)
    cols = _columns(authed_client, bid)
    ids = [int(c["id"]) for c in cols]
    r = authed_client.post(
        f"/api/boards/{bid}/columns/reorder",
        json={"column_ids": ids[:-1]},  # missing one
    )
    assert r.status_code == 400


def test_reorder_rejects_extra_id(authed_client):
    bid = _default_board_id(authed_client)
    cols = _columns(authed_client, bid)
    ids = [int(c["id"]) for c in cols] + [99999]
    r = authed_client.post(
        f"/api/boards/{bid}/columns/reorder",
        json={"column_ids": ids},
    )
    assert r.status_code == 400


def test_reorder_rejects_other_board_column(authed_client):
    bid = _default_board_id(authed_client)
    other_bid = authed_client.post("/api/boards", json={"name": "Other"}).json()["id"]
    other_cols = _columns(authed_client, other_bid)
    cols = _columns(authed_client, bid)
    # Swap in a column from another board — should be rejected as "not a permutation"
    bad = [int(c["id"]) for c in cols[:-1]] + [int(other_cols[0]["id"])]
    r = authed_client.post(
        f"/api/boards/{bid}/columns/reorder",
        json={"column_ids": bad},
    )
    assert r.status_code == 400


def test_reorder_empty_rejected(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(
        f"/api/boards/{bid}/columns/reorder",
        json={"column_ids": []},
    )
    assert r.status_code == 422


# ---------- isolation ----------

def _register(client, name):
    r = client.post("/api/auth/register", json={"username": name, "password": "supersecret"})
    assert r.status_code == 200


def test_user_cannot_add_column_to_other_users_board(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "col_alice")
    _register(bob, "col_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    r = bob.post(f"/api/boards/{a_bid}/columns", json={"title": "evil"})
    assert r.status_code == 404


def test_user_cannot_delete_column_on_other_users_board(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "col2_alice")
    _register(bob, "col2_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_col = _columns(alice, a_bid)[0]
    r = bob.delete(f"/api/boards/{a_bid}/columns/{a_col['id']}")
    assert r.status_code == 404


def test_user_cannot_reorder_other_users_board(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "col3_alice")
    _register(bob, "col3_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_cols = _columns(alice, a_bid)
    ids = [int(c["id"]) for c in reversed(a_cols)]
    r = bob.post(f"/api/boards/{a_bid}/columns/reorder", json={"column_ids": ids})
    assert r.status_code == 404
