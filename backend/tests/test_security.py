from backend.security import (
    hash_password,
    is_legacy_sha256,
    verify_legacy_sha256,
    verify_password,
)


def test_hash_round_trip():
    stored = hash_password("hunter2")
    assert verify_password("hunter2", stored)
    assert not verify_password("hunter3", stored)


def test_hash_format():
    stored = hash_password("anything")
    parts = stored.split("$")
    # prefix, n, r, p, salt_hex, hash_hex
    assert len(parts) == 6
    assert parts[0] == "scrypt"
    assert int(parts[1]) > 1024  # n large enough


def test_verify_rejects_garbage():
    assert not verify_password("anything", "")
    assert not verify_password("anything", "not-a-hash")
    assert not verify_password("anything", "scrypt$1$1$1$zz$zz")


def test_legacy_sha256_detection_and_verify():
    import hashlib
    legacy = hashlib.sha256(b"password").hexdigest()
    assert is_legacy_sha256(legacy)
    assert verify_legacy_sha256("password", legacy)
    assert not verify_legacy_sha256("wrong", legacy)


def test_legacy_login_is_auto_upgraded(client):
    """Seeded users on the old sha256 format should upgrade on first login."""
    import hashlib

    from backend.database import get_db
    from backend.main import app
    from backend.models import User

    override = app.dependency_overrides[get_db]
    gen = override()
    db = next(gen)
    try:
        user = db.query(User).filter_by(username="user").first()
        user.hashed_password = hashlib.sha256(b"password").hexdigest()
        db.commit()
    finally:
        gen.close()

    r = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert r.status_code == 200

    gen = override()
    db = next(gen)
    try:
        user = db.query(User).filter_by(username="user").first()
        assert user.hashed_password.startswith("scrypt$")
    finally:
        gen.close()
