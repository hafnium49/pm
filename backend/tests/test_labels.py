"""Label CRUD + card label attach/detach + isolation."""
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


# ---------- unauthenticated ----------

def test_list_labels_unauthorized(client):
    r = client.get("/api/boards/1/labels")
    assert r.status_code == 401


def test_create_label_unauthorized(client):
    r = client.post("/api/boards/1/labels", json={"name": "bug", "color": "red"})
    assert r.status_code == 401


def test_set_card_labels_unauthorized(client):
    r = client.post("/api/boards/1/cards/1/labels", json={"label_ids": []})
    assert r.status_code == 401


# ---------- CRUD ----------

def test_list_labels_starts_empty(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.get(f"/api/boards/{bid}/labels")
    assert r.status_code == 200
    assert r.json() == {"labels": []}


def test_create_label(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"})
    assert r.status_code == 200
    label = r.json()
    assert label["name"] == "Bug"
    assert label["color"] == "red"
    listed = authed_client.get(f"/api/boards/{bid}/labels").json()["labels"]
    assert any(l["id"] == label["id"] for l in listed)


def test_create_label_invalid_color_rejected(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "X", "color": "pizza"})
    assert r.status_code == 422


def test_create_label_blank_name_rejected(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "", "color": "red"})
    assert r.status_code == 422


def test_create_duplicate_label_name_rejected(authed_client):
    bid = _default_board_id(authed_client)
    authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"})
    r = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "amber"})
    assert r.status_code == 409


def test_same_name_allowed_on_different_boards(authed_client):
    bid1 = _default_board_id(authed_client)
    bid2 = authed_client.post("/api/boards", json={"name": "Another"}).json()["id"]
    a = authed_client.post(f"/api/boards/{bid1}/labels", json={"name": "Bug", "color": "red"})
    b = authed_client.post(f"/api/boards/{bid2}/labels", json={"name": "Bug", "color": "blue"})
    assert a.status_code == 200
    assert b.status_code == 200


def test_update_label(authed_client):
    bid = _default_board_id(authed_client)
    lid = authed_client.post(
        f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"}
    ).json()["id"]
    r = authed_client.post(
        f"/api/boards/{bid}/labels/{lid}", json={"name": "Bug-fix", "color": "amber"}
    )
    assert r.status_code == 200
    out = r.json()
    assert out["name"] == "Bug-fix"
    assert out["color"] == "amber"


def test_delete_label(authed_client):
    bid = _default_board_id(authed_client)
    lid = authed_client.post(
        f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"}
    ).json()["id"]
    r = authed_client.delete(f"/api/boards/{bid}/labels/{lid}")
    assert r.status_code == 200
    listed = authed_client.get(f"/api/boards/{bid}/labels").json()["labels"]
    assert not any(l["id"] == lid for l in listed)


def test_delete_label_404(authed_client):
    bid = _default_board_id(authed_client)
    r = authed_client.delete(f"/api/boards/{bid}/labels/99999")
    assert r.status_code == 404


# ---------- attach / detach ----------

def test_attach_labels_to_card(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    bug = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"}).json()
    feat = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Feature", "color": "emerald"}).json()
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/labels",
        json={"label_ids": [int(bug["id"]), int(feat["id"])]},
    )
    assert r.status_code == 200
    out = r.json()["labels"]
    names = {l["name"] for l in out}
    assert names == {"Bug", "Feature"}

    # Re-fetch board: card now has these labels in its serialization
    full = authed_client.get(f"/api/boards/{bid}").json()
    assert names == {l["name"] for l in full["cards"][card["id"]]["labels"]}


def test_detach_labels_with_empty_list(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    bug = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"}).json()
    authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/labels",
        json={"label_ids": [int(bug["id"])]},
    )
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/labels",
        json={"label_ids": []},
    )
    assert r.status_code == 200
    assert r.json()["labels"] == []


def test_attach_unknown_label_404(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/labels",
        json={"label_ids": [9999]},
    )
    assert r.status_code == 404


def test_attach_label_from_other_board_404(authed_client):
    bid1 = _default_board_id(authed_client)
    bid2 = authed_client.post("/api/boards", json={"name": "Other"}).json()["id"]
    label_on_b2 = authed_client.post(
        f"/api/boards/{bid2}/labels", json={"name": "X", "color": "slate"}
    ).json()
    card_on_b1 = _new_card(authed_client, bid1)
    r = authed_client.post(
        f"/api/boards/{bid1}/cards/{card_on_b1['id']}/labels",
        json={"label_ids": [int(label_on_b2["id"])]},
    )
    assert r.status_code == 404


def test_deleting_label_removes_it_from_cards(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    bug = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"}).json()
    feat = authed_client.post(f"/api/boards/{bid}/labels", json={"name": "Feature", "color": "emerald"}).json()
    authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/labels",
        json={"label_ids": [int(bug["id"]), int(feat["id"])]},
    )
    authed_client.delete(f"/api/boards/{bid}/labels/{bug['id']}")
    full = authed_client.get(f"/api/boards/{bid}").json()
    remaining = full["cards"][card["id"]]["labels"]
    assert len(remaining) == 1
    assert remaining[0]["name"] == "Feature"


# ---------- isolation ----------

def _register(client, name):
    r = client.post("/api/auth/register", json={"username": name, "password": "supersecret"})
    assert r.status_code == 200


def test_user_cannot_list_other_users_labels(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "lab_alice")
    _register(bob, "lab_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    r = bob.get(f"/api/boards/{a_bid}/labels")
    assert r.status_code == 404


def test_user_cannot_create_label_on_other_users_board(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "lab2_alice")
    _register(bob, "lab2_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    r = bob.post(f"/api/boards/{a_bid}/labels", json={"name": "evil", "color": "red"})
    assert r.status_code == 404


def test_user_cannot_attach_labels_to_other_users_card(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "lab3_alice")
    _register(bob, "lab3_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_card = _new_card(alice, a_bid, title="alice card")
    a_label = alice.post(f"/api/boards/{a_bid}/labels", json={"name": "L", "color": "red"}).json()
    r = bob.post(
        f"/api/boards/{a_bid}/cards/{a_card['id']}/labels",
        json={"label_ids": [int(a_label["id"])]},
    )
    assert r.status_code == 404


# ---------- card serialization ----------

def test_card_serialization_includes_labels(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    full = authed_client.get(f"/api/boards/{bid}").json()
    assert full["cards"][card["id"]]["labels"] == []


def test_board_delete_cascades_labels(authed_client):
    bid = authed_client.post("/api/boards", json={"name": "ToDelete"}).json()["id"]
    lid = authed_client.post(
        f"/api/boards/{bid}/labels", json={"name": "Bug", "color": "red"}
    ).json()["id"]
    authed_client.delete(f"/api/boards/{bid}")
    # Trying to fetch the label now returns 404
    r = authed_client.post(f"/api/boards/{bid}/labels/{lid}", json={"name": "x"})
    assert r.status_code == 404
