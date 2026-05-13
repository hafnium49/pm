"""Archive (soft-delete) + restore + purge tests."""
from fastapi.testclient import TestClient

from backend.main import app


def _default_board_id(client):
    return client.get("/api/boards").json()["boards"][0]["id"]


def _first_col(client, bid):
    return client.get(f"/api/boards/{bid}").json()["columns"][0]


def _new_card(client, bid, title="X", column_id=None):
    col = column_id or int(_first_col(client, bid)["id"])
    r = client.post(f"/api/boards/{bid}/cards", json={"column_id": col, "title": title})
    assert r.status_code == 200
    return r.json()


# ---------- auth ----------

def test_list_archive_unauthorized(client):
    r = client.get("/api/boards/1/archive")
    assert r.status_code == 401


def test_restore_unauthorized(client):
    r = client.post("/api/boards/1/cards/1/restore")
    assert r.status_code == 401


def test_purge_unauthorized(client):
    r = client.delete("/api/boards/1/archive/1")
    assert r.status_code == 401


# ---------- archive flow ----------

def test_archive_hides_card_from_board(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid, title="hide me")
    full_before = authed_client.get(f"/api/boards/{bid}").json()
    assert card["id"] in full_before["cards"]

    r = authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    assert r.status_code == 200

    full_after = authed_client.get(f"/api/boards/{bid}").json()
    assert card["id"] not in full_after["cards"]
    assert all(card["id"] not in col["cardIds"] for col in full_after["columns"])


def test_archive_list_shows_archived_cards(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid, title="for archive")
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")

    r = authed_client.get(f"/api/boards/{bid}/archive")
    assert r.status_code == 200
    archived = r.json()["cards"]
    assert len(archived) == 1
    a = archived[0]
    assert a["id"] == card["id"]
    assert a["title"] == "for archive"
    assert a["archived_at"] is not None
    assert "column_id" in a and "column_title" in a


def test_board_summary_card_count_excludes_archived(authed_client):
    bid = _default_board_id(authed_client)
    a = _new_card(authed_client, bid, title="A")
    b = _new_card(authed_client, bid, title="B")
    authed_client.delete(f"/api/boards/{bid}/cards/{a['id']}")
    summary = next(
        s for s in authed_client.get("/api/boards").json()["boards"] if s["id"] == bid
    )
    assert summary["card_count"] == 1
    # Removing B too → 0
    authed_client.delete(f"/api/boards/{bid}/cards/{b['id']}")
    summary = next(
        s for s in authed_client.get("/api/boards").json()["boards"] if s["id"] == bid
    )
    assert summary["card_count"] == 0


def test_archive_404_for_already_archived(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    r = authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    assert r.status_code == 404


def test_archive_compacts_positions(authed_client):
    bid = _default_board_id(authed_client)
    col_id = int(_first_col(authed_client, bid)["id"])
    a = _new_card(authed_client, bid, title="A", column_id=col_id)
    b = _new_card(authed_client, bid, title="B", column_id=col_id)
    c = _new_card(authed_client, bid, title="C", column_id=col_id)
    # Archive the middle one
    authed_client.delete(f"/api/boards/{bid}/cards/{b['id']}")
    cards = authed_client.get(f"/api/boards/{bid}").json()
    col = next(c for c in cards["columns"] if c["id"] == str(col_id))
    assert col["cardIds"] == [a["id"], c["id"]]


# ---------- restore ----------

def test_restore_brings_card_back(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid, title="restore me")
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    r = authed_client.post(f"/api/boards/{bid}/cards/{card['id']}/restore")
    assert r.status_code == 200
    out = r.json()
    assert out["id"] == card["id"]

    full = authed_client.get(f"/api/boards/{bid}").json()
    assert card["id"] in full["cards"]
    # Archive is empty
    archived = authed_client.get(f"/api/boards/{bid}/archive").json()["cards"]
    assert archived == []


def test_restore_places_card_at_end_of_active_list(authed_client):
    bid = _default_board_id(authed_client)
    col_id = int(_first_col(authed_client, bid)["id"])
    a = _new_card(authed_client, bid, title="A", column_id=col_id)
    b = _new_card(authed_client, bid, title="B", column_id=col_id)
    authed_client.delete(f"/api/boards/{bid}/cards/{a['id']}")
    _new_card(authed_client, bid, title="C", column_id=col_id)
    authed_client.post(f"/api/boards/{bid}/cards/{a['id']}/restore")
    cards = authed_client.get(f"/api/boards/{bid}").json()
    col = next(c for c in cards["columns"] if c["id"] == str(col_id))
    # A goes to the end
    assert col["cardIds"][-1] == a["id"]


def test_restore_404_if_not_archived(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(f"/api/boards/{bid}/cards/{card['id']}/restore")
    assert r.status_code == 404


def test_column_delete_cascades_archived_cards(authed_client):
    """Deleting a column wipes its archived cards along with active ones."""
    bid = _default_board_id(authed_client)
    extra = authed_client.post(
        f"/api/boards/{bid}/columns", json={"title": "Temporary"}
    ).json()
    card = _new_card(authed_client, bid, column_id=int(extra["id"]), title="orphan")
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    # Archive currently has 1 entry
    assert len(authed_client.get(f"/api/boards/{bid}/archive").json()["cards"]) == 1
    # Delete the column the card came from
    authed_client.delete(f"/api/boards/{bid}/columns/{extra['id']}")
    # Archive is empty — the row cascaded
    assert authed_client.get(f"/api/boards/{bid}/archive").json()["cards"] == []
    # Restoring 404s
    assert authed_client.post(f"/api/boards/{bid}/cards/{card['id']}/restore").status_code == 404


# ---------- purge ----------

def test_purge_removes_card_permanently(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid, title="goodbye")
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    r = authed_client.delete(f"/api/boards/{bid}/archive/{card['id']}")
    assert r.status_code == 200
    # Subsequent restore 404s — record is gone
    assert authed_client.post(f"/api/boards/{bid}/cards/{card['id']}/restore").status_code == 404
    assert authed_client.get(f"/api/boards/{bid}/archive").json()["cards"] == []


def test_purge_404_if_not_archived(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.delete(f"/api/boards/{bid}/archive/{card['id']}")
    assert r.status_code == 404


# ---------- archived cards are inert ----------

def test_cannot_update_archived_card(authed_client):
    bid = _default_board_id(authed_client)
    card = _new_card(authed_client, bid)
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}",
        json={"title": "renamed?"},
    )
    assert r.status_code == 404


def test_cannot_move_archived_card(authed_client):
    bid = _default_board_id(authed_client)
    cols = authed_client.get(f"/api/boards/{bid}").json()["columns"]
    card = _new_card(authed_client, bid, column_id=int(cols[0]["id"]))
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/move",
        json={"column_id": int(cols[1]["id"]), "position": 0},
    )
    assert r.status_code == 404


# ---------- isolation ----------

def _register(client, name):
    r = client.post("/api/auth/register", json={"username": name, "password": "supersecret"})
    assert r.status_code == 200


def test_user_cannot_list_archive_on_other_users_board(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "arc_alice")
    _register(bob, "arc_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    r = bob.get(f"/api/boards/{a_bid}/archive")
    assert r.status_code == 404


def test_user_cannot_restore_other_users_card(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "arc2_alice")
    _register(bob, "arc2_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_card = _new_card(alice, a_bid)
    alice.delete(f"/api/boards/{a_bid}/cards/{a_card['id']}")
    r = bob.post(f"/api/boards/{a_bid}/cards/{a_card['id']}/restore")
    assert r.status_code == 404


def test_user_cannot_purge_other_users_card(client):
    alice = TestClient(app)
    bob = TestClient(app)
    _register(alice, "arc3_alice")
    _register(bob, "arc3_bob")
    a_bid = alice.get("/api/boards").json()["boards"][0]["id"]
    a_card = _new_card(alice, a_bid)
    alice.delete(f"/api/boards/{a_bid}/cards/{a_card['id']}")
    r = bob.delete(f"/api/boards/{a_bid}/archive/{a_card['id']}")
    assert r.status_code == 404
