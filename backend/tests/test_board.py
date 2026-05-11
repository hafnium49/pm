# --- unauthenticated ---

def test_get_board_unauthenticated(client):
    r = client.get("/api/board")
    assert r.status_code == 401


def test_rename_column_unauthenticated(client):
    r = client.post("/api/board/columns/1/rename", json={"title": "x"})
    assert r.status_code == 401


def test_create_card_unauthenticated(client):
    r = client.post("/api/board/cards", json={"column_id": 1, "title": "x", "details": ""})
    assert r.status_code == 401


def test_delete_card_unauthenticated(client):
    r = client.delete("/api/board/cards/1")
    assert r.status_code == 401


def test_move_card_unauthenticated(client):
    r = client.post("/api/board/cards/1/move", json={"column_id": 1, "position": 0})
    assert r.status_code == 401


# --- authenticated happy paths ---

def test_get_board(authed_client):
    r = authed_client.get("/api/board")
    assert r.status_code == 200
    data = r.json()
    assert len(data["columns"]) == 5
    assert data["columns"][0]["title"] == "Backlog"
    assert isinstance(data["cards"], dict)


def test_rename_column(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = board["columns"][0]["id"]
    r = authed_client.post(f"/api/board/columns/{col_id}/rename", json={"title": "Todo"})
    assert r.status_code == 200
    board2 = authed_client.get("/api/board").json()
    assert board2["columns"][0]["title"] == "Todo"


def test_rename_column_not_found(authed_client):
    r = authed_client.post("/api/board/columns/99999/rename", json={"title": "x"})
    assert r.status_code == 404


def test_create_card(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    r = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "Test card", "details": "Some details"})
    assert r.status_code == 200
    card = r.json()
    assert card["title"] == "Test card"
    board2 = authed_client.get("/api/board").json()
    assert card["id"] in board2["cards"]
    assert card["id"] in board2["columns"][0]["cardIds"]


def test_delete_card(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    card = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "ToDelete", "details": ""}).json()
    r = authed_client.delete(f"/api/board/cards/{card['id']}")
    assert r.status_code == 200
    board2 = authed_client.get("/api/board").json()
    assert card["id"] not in board2["cards"]


def test_delete_card_not_found(authed_client):
    r = authed_client.delete("/api/board/cards/99999")
    assert r.status_code == 404


def test_move_card_same_column(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    c1 = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "C1", "details": ""}).json()
    c2 = authed_client.post("/api/board/cards", json={"column_id": col_id, "title": "C2", "details": ""}).json()
    r = authed_client.post(f"/api/board/cards/{c2['id']}/move", json={"column_id": col_id, "position": 0})
    assert r.status_code == 200
    board2 = authed_client.get("/api/board").json()
    col_cards = board2["columns"][0]["cardIds"]
    assert col_cards.index(c2["id"]) < col_cards.index(c1["id"])


def test_move_card_different_column(authed_client):
    board = authed_client.get("/api/board").json()
    col0_id = int(board["columns"][0]["id"])
    col1_id = int(board["columns"][1]["id"])
    card = authed_client.post("/api/board/cards", json={"column_id": col0_id, "title": "ToMove", "details": ""}).json()
    r = authed_client.post(f"/api/board/cards/{card['id']}/move", json={"column_id": col1_id, "position": 0})
    assert r.status_code == 200
    board2 = authed_client.get("/api/board").json()
    assert card["id"] in board2["columns"][1]["cardIds"]
    assert card["id"] not in board2["columns"][0]["cardIds"]


def test_move_card_not_found(authed_client):
    board = authed_client.get("/api/board").json()
    col_id = int(board["columns"][0]["id"])
    r = authed_client.post("/api/board/cards/99999/move", json={"column_id": col_id, "position": 0})
    assert r.status_code == 404
