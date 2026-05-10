import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def test_login_success(client):
    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert r.status_code == 200
    assert r.json()["username"] == "user"
    assert "session" in r.cookies


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert r.status_code == 401


def test_login_wrong_username(client):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "password"})
    assert r.status_code == 401


def test_me_authenticated(client):
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "user"


def test_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout(client):
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    # Cookie is cleared; me should 401
    client.cookies.clear()
    r2 = client.get("/api/auth/me")
    assert r2.status_code == 401
