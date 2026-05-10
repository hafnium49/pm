import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app, raise_server_exceptions=True)


def test_login_success():
    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert r.status_code == 200
    assert r.json()["username"] == "user"
    assert "session" in r.cookies


def test_login_wrong_password():
    r = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert r.status_code == 401


def test_login_wrong_username():
    r = client.post("/api/auth/login", json={"username": "admin", "password": "password"})
    assert r.status_code == 401


def test_me_authenticated():
    # Log in first to get a session cookie
    login = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    session = login.cookies["session"]
    r = client.get("/api/auth/me", cookies={"session": session})
    assert r.status_code == 200
    assert r.json()["username"] == "user"


def test_me_unauthenticated():
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout():
    login = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    session = login.cookies["session"]
    r = client.post("/api/auth/logout", cookies={"session": session})
    assert r.status_code == 200
    # After logout, me should return 401
    r2 = client.get("/api/auth/me")
    assert r2.status_code == 401
