def test_list_boards_unauthenticated(client):
    r = client.get("/api/boards")
    assert r.status_code == 401


def test_list_boards_default(authed_client):
    r = authed_client.get("/api/boards")
    assert r.status_code == 200
    boards = r.json()["boards"]
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    assert boards[0]["column_count"] == 5
    assert boards[0]["card_count"] == 0


def test_create_board(authed_client):
    r = authed_client.post("/api/boards", json={"name": "Project Phoenix"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Project Phoenix"
    assert len(data["columns"]) == 5
    assert {c["title"] for c in data["columns"]} == {
        "Backlog", "Discovery", "In Progress", "Review", "Done",
    }
    assert data["cards"] == {}

    boards = authed_client.get("/api/boards").json()["boards"]
    assert len(boards) == 2


def test_create_board_rejects_empty_name(authed_client):
    r = authed_client.post("/api/boards", json={"name": ""})
    assert r.status_code == 422


def test_get_board_by_id(authed_client):
    created = authed_client.post("/api/boards", json={"name": "B"}).json()
    board_id = created["id"]
    r = authed_client.get(f"/api/boards/{board_id}")
    assert r.status_code == 200
    assert r.json()["name"] == "B"


def test_get_board_404(authed_client):
    r = authed_client.get("/api/boards/9999")
    assert r.status_code == 404


def test_rename_board(authed_client):
    boards = authed_client.get("/api/boards").json()["boards"]
    bid = boards[0]["id"]
    r = authed_client.post(f"/api/boards/{bid}/rename", json={"name": "Renamed"})
    assert r.status_code == 200
    refreshed = authed_client.get("/api/boards").json()["boards"]
    assert refreshed[0]["name"] == "Renamed"


def test_delete_board(authed_client):
    authed_client.post("/api/boards", json={"name": "Extra"})
    boards = authed_client.get("/api/boards").json()["boards"]
    assert len(boards) == 2
    extra_id = next(b["id"] for b in boards if b["name"] == "Extra")
    r = authed_client.delete(f"/api/boards/{extra_id}")
    assert r.status_code == 200
    remaining = authed_client.get("/api/boards").json()["boards"]
    assert len(remaining) == 1
    assert all(b["name"] != "Extra" for b in remaining)


def test_delete_last_board_blocked(authed_client):
    boards = authed_client.get("/api/boards").json()["boards"]
    bid = boards[0]["id"]
    r = authed_client.delete(f"/api/boards/{bid}")
    assert r.status_code == 400


def test_card_on_specific_board(authed_client):
    a = authed_client.post("/api/boards", json={"name": "A"}).json()
    b = authed_client.post("/api/boards", json={"name": "B"}).json()
    a_col = int(a["columns"][0]["id"])
    b_col = int(b["columns"][0]["id"])

    r = authed_client.post(
        f"/api/boards/{a['id']}/cards",
        json={"column_id": a_col, "title": "On A", "details": ""},
    )
    assert r.status_code == 200

    # The card should be on A, not on B
    a_after = authed_client.get(f"/api/boards/{a['id']}").json()
    b_after = authed_client.get(f"/api/boards/{b['id']}").json()
    assert any(c["title"] == "On A" for c in a_after["cards"].values())
    assert all(c["title"] != "On A" for c in b_after["cards"].values())

    # Posting card with a column from a different board must 404
    r = authed_client.post(
        f"/api/boards/{a['id']}/cards",
        json={"column_id": b_col, "title": "wrong board", "details": ""},
    )
    assert r.status_code == 404


def test_move_card_within_board(authed_client):
    bid = authed_client.get("/api/boards").json()["boards"][0]["id"]
    board = authed_client.get(f"/api/boards/{bid}").json()
    col0 = int(board["columns"][0]["id"])
    col1 = int(board["columns"][1]["id"])
    card = authed_client.post(
        f"/api/boards/{bid}/cards",
        json={"column_id": col0, "title": "moving", "details": ""},
    ).json()
    r = authed_client.post(
        f"/api/boards/{bid}/cards/{card['id']}/move",
        json={"column_id": col1, "position": 0},
    )
    assert r.status_code == 200
    refreshed = authed_client.get(f"/api/boards/{bid}").json()
    assert card["id"] in refreshed["columns"][1]["cardIds"]


def test_delete_card_on_board(authed_client):
    bid = authed_client.get("/api/boards").json()["boards"][0]["id"]
    board = authed_client.get(f"/api/boards/{bid}").json()
    col0 = int(board["columns"][0]["id"])
    card = authed_client.post(
        f"/api/boards/{bid}/cards",
        json={"column_id": col0, "title": "trash me", "details": ""},
    ).json()
    r = authed_client.delete(f"/api/boards/{bid}/cards/{card['id']}")
    assert r.status_code == 200
    refreshed = authed_client.get(f"/api/boards/{bid}").json()
    assert card["id"] not in refreshed["cards"]


def test_rename_column_on_board(authed_client):
    bid = authed_client.get("/api/boards").json()["boards"][0]["id"]
    board = authed_client.get(f"/api/boards/{bid}").json()
    col_id = int(board["columns"][0]["id"])
    r = authed_client.post(
        f"/api/boards/{bid}/columns/{col_id}/rename",
        json={"title": "ToDo"},
    )
    assert r.status_code == 200
    refreshed = authed_client.get(f"/api/boards/{bid}").json()
    assert refreshed["columns"][0]["title"] == "ToDo"
