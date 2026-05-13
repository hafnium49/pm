"""Checklist (subtask) CRUD + role enforcement + isolation."""
from fastapi.testclient import TestClient

from backend.main import app


def _bid(client):
    return client.get("/api/boards").json()["boards"][0]["id"]


def _first_col(client, bid):
    return int(client.get(f"/api/boards/{bid}").json()["columns"][0]["id"])


def _new_card(client, bid, title="X"):
    col = _first_col(client, bid)
    r = client.post(f"/api/boards/{bid}/cards", json={"column_id": col, "title": title})
    assert r.status_code == 200
    return r.json()


# ---------- auth ----------

def test_list_checklist_unauthorized(client):
    r = client.get("/api/boards/1/cards/1/checklist")
    assert r.status_code == 401


def test_add_checklist_unauthorized(client):
    r = client.post("/api/boards/1/cards/1/checklist", json={"text": "x"})
    assert r.status_code == 401


def test_update_checklist_unauthorized(client):
    r = client.post("/api/boards/1/cards/1/checklist/1", json={"done": True})
    assert r.status_code == 401


def test_delete_checklist_unauthorized(client):
    r = client.delete("/api/boards/1/cards/1/checklist/1")
    assert r.status_code == 401


# ---------- CRUD ----------

def test_list_empty_initially(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/checklist")
    assert r.status_code == 200
    assert r.json() == {"items": []}


def test_add_item(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "write tests"},
    )
    assert r.status_code == 200
    item = r.json()
    assert item["text"] == "write tests"
    assert item["done"] is False
    assert item["position"] == 0


def test_items_preserve_order(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    for t in ["a", "b", "c"]:
        authed_client.post(f"/api/boards/{bid}/cards/{card['id']}/checklist", json={"text": t})
    items = authed_client.get(f"/api/boards/{bid}/cards/{card['id']}/checklist").json()["items"]
    assert [i["text"] for i in items] == ["a", "b", "c"]
    assert [i["position"] for i in items] == [0, 1, 2]


def test_add_item_blank_rejected(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": ""},
    )
    assert r.status_code == 422


def test_add_item_trims(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "   tidy   "},
    )
    assert r.json()["text"] == "tidy"


def test_toggle_done(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    item = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "step"},
    ).json()
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{item['id']}",
        json={"done": True},
    )
    assert r.status_code == 200
    assert r.json()["done"] is True
    r2 = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{item['id']}",
        json={"done": False},
    )
    assert r2.json()["done"] is False


def test_edit_text(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    item = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "orig"},
    ).json()
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{item['id']}",
        json={"text": "renamed"},
    )
    assert r.status_code == 200
    assert r.json()["text"] == "renamed"


def test_update_unknown_404(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/99999",
        json={"done": True},
    )
    assert r.status_code == 404


def test_delete_item_compacts_positions(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    items = []
    for t in ["a", "b", "c"]:
        items.append(
            authed_client.post(
                f"/api/boards/{bid}/cards/{card['id']}/checklist",
                json={"text": t},
            ).json()
        )
    # Delete the middle one
    r = authed_client.delete(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{items[1]['id']}"
    )
    assert r.status_code == 200
    remaining = authed_client.get(
        f"/api/boards/{bid}/cards/{card['id']}/checklist"
    ).json()["items"]
    assert [i["text"] for i in remaining] == ["a", "c"]
    assert [i["position"] for i in remaining] == [0, 1]


# ---------- aggregates on card payload ----------

def test_card_payload_has_checklist_counts(authed_client):
    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    payload = authed_client.get(f"/api/boards/{bid}").json()
    assert payload["cards"][card["id"]]["checklist_total"] == 0
    assert payload["cards"][card["id"]]["checklist_done"] == 0

    a = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "a"},
    ).json()
    authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "b"},
    )
    # Mark a as done
    authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{a['id']}",
        json={"done": True},
    )
    refreshed = authed_client.get(f"/api/boards/{bid}").json()
    assert refreshed["cards"][card["id"]]["checklist_total"] == 2
    assert refreshed["cards"][card["id"]]["checklist_done"] == 1


def test_card_delete_cascades_checklist(authed_client):
    """Purging an archived card cleans up checklist items."""
    from backend.database import get_db
    from backend.main import app as fastapi_app
    from backend.models import ChecklistItem

    bid = _bid(authed_client)
    card = _new_card(authed_client, bid)
    item = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist",
        json={"text": "doomed"},
    ).json()
    # Archive then purge
    authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    authed_client.delete(f"/api/boards/{bid}/archive/{card['id']}")

    override = fastapi_app.dependency_overrides[get_db]
    gen = override()
    db = next(gen)
    try:
        assert db.query(ChecklistItem).filter_by(id=int(item["id"])).first() is None
    finally:
        gen.close()


# ---------- role enforcement ----------

def _make_pair(role="editor"):
    alice = TestClient(app)
    bob = TestClient(app)
    alice.post("/api/auth/register", json={"username": "alice", "password": "supersecret"})
    bob.post("/api/auth/register", json={"username": "bob", "password": "supersecret"})
    a_bid = _bid(alice)
    alice.post(f"/api/boards/{a_bid}/members", json={"username": "bob", "role": role})
    return alice, bob, a_bid


def test_viewer_can_read_checklist(client):
    alice, bob, bid = _make_pair("viewer")
    card = _new_card(alice, bid)
    alice.post(f"/api/boards/{bid}/cards/{card['id']}/checklist", json={"text": "step"})
    r = bob.get(f"/api/boards/{bid}/cards/{card['id']}/checklist")
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1


def test_viewer_cannot_add_item(client):
    alice, bob, bid = _make_pair("viewer")
    card = _new_card(alice, bid)
    r = bob.post(f"/api/boards/{bid}/cards/{card['id']}/checklist", json={"text": "evil"})
    assert r.status_code == 403


def test_viewer_cannot_toggle(client):
    alice, bob, bid = _make_pair("viewer")
    card = _new_card(alice, bid)
    item = alice.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist", json={"text": "step"}
    ).json()
    r = bob.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{item['id']}",
        json={"done": True},
    )
    assert r.status_code == 403


def test_editor_can_modify(client):
    alice, bob, bid = _make_pair("editor")
    card = _new_card(alice, bid)
    item = bob.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist", json={"text": "go"}
    ).json()
    assert bob.post(
        f"/api/boards/{bid}/cards/{card['id']}/checklist/{item['id']}",
        json={"done": True},
    ).status_code == 200


# ---------- isolation ----------

def test_non_member_cannot_list(client):
    alice = TestClient(app)
    eve = TestClient(app)
    alice.post("/api/auth/register", json={"username": "chk_alice", "password": "supersecret"})
    eve.post("/api/auth/register", json={"username": "chk_eve", "password": "supersecret"})
    a_bid = _bid(alice)
    a_card = _new_card(alice, a_bid)
    r = eve.get(f"/api/boards/{a_bid}/cards/{a_card['id']}/checklist")
    assert r.status_code == 404
