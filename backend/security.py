import hashlib
import hmac
import os
import secrets

# scrypt parameters tuned for ~100ms hash time on typical hardware
SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SALT_LEN = 16
PREFIX = "scrypt"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(SALT_LEN)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return f"{PREFIX}${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    parts = stored.split("$")
    if len(parts) != 6 or parts[0] != PREFIX:
        return False
    try:
        n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
        salt = bytes.fromhex(parts[4])
        expected = bytes.fromhex(parts[5])
    except ValueError:
        return False
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=len(expected),
    )
    return hmac.compare_digest(derived, expected)


def is_legacy_sha256(stored: str) -> bool:
    """Detect the unsalted sha256 hex format used by the initial seed."""
    return len(stored) == 64 and all(c in "0123456789abcdef" for c in stored)


def verify_legacy_sha256(password: str, stored: str) -> bool:
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(digest, stored)
