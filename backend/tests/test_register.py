def test_register_creates_user_and_session(client):
    r = client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "supersecret"},
    )
    assert r.status_code == 200
    assert r.json()["username"] == "alice"
    assert "session" in r.cookies

    # New user is logged in: /me returns their name
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "alice"


def test_register_seeds_default_board(client):
    client.post("/api/auth/register", json={"username": "bob", "password": "supersecret"})
    boards = client.get("/api/boards").json()["boards"]
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    assert boards[0]["column_count"] == 5


def test_register_rejects_short_password(client):
    r = client.post("/api/auth/register", json={"username": "carol", "password": "short"})
    assert r.status_code == 400


def test_register_rejects_bad_username(client):
    r = client.post("/api/auth/register", json={"username": "no spaces!", "password": "supersecret"})
    assert r.status_code == 400


def test_register_duplicate_username_conflict(client):
    client.post("/api/auth/register", json={"username": "dave", "password": "supersecret"})
    client.cookies.clear()
    r = client.post("/api/auth/register", json={"username": "dave", "password": "supersecret"})
    assert r.status_code == 409


def test_login_after_register(client):
    client.post("/api/auth/register", json={"username": "eve", "password": "supersecret"})
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "eve", "password": "supersecret"})
    assert r.status_code == 200
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "eve"


def test_login_with_wrong_password_after_register(client):
    client.post("/api/auth/register", json={"username": "frank", "password": "supersecret"})
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "frank", "password": "wrongpass"})
    assert r.status_code == 401


def test_password_hash_is_salted(client):
    """Two registrations with the same password produce different stored hashes."""
    from backend.security import hash_password
    h1 = hash_password("samepassword")
    h2 = hash_password("samepassword")
    assert h1 != h2
    assert h1.startswith("scrypt$")
    assert h2.startswith("scrypt$")
