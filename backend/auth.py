import os
import re

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Board, KanbanColumn, User
from backend.security import (
    hash_password,
    is_legacy_sha256,
    verify_legacy_sha256,
    verify_password,
)

router = APIRouter(prefix="/api/auth")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-do-not-use-in-prod")
COOKIE_NAME = "session"
MAX_AGE = 60 * 60 * 24  # 24 hours
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]

signer = TimestampSigner(SECRET_KEY)


class CredentialsBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class ChangeUsernameBody(BaseModel):
    password: str = Field(min_length=1, max_length=256)
    new_username: str = Field(min_length=3, max_length=32)


class DeleteAccountBody(BaseModel):
    password: str = Field(min_length=1, max_length=256)


def _set_session_cookie(response: Response, username: str) -> None:
    token = signer.sign(username).decode()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="strict",
        max_age=MAX_AGE,
    )


def _authenticate(username: str, password: str, db: Session) -> User | None:
    user = db.query(User).filter_by(username=username).first()
    if not user:
        return None
    stored = user.hashed_password
    if verify_password(password, stored):
        return user
    if is_legacy_sha256(stored) and verify_legacy_sha256(password, stored):
        user.hashed_password = hash_password(password)
        db.commit()
        return user
    return None


def _seed_board_for(user: User, db: Session) -> Board:
    board = Board(user_id=user.id, name="My Board")
    db.add(board)
    db.flush()
    for i, title in enumerate(DEFAULT_COLUMNS):
        db.add(KanbanColumn(board_id=board.id, title=title, position=i))
    db.flush()
    return board


@router.post("/register")
def register(body: CredentialsBody, response: Response, db: Session = Depends(get_db)):
    username = body.username.strip()
    if not USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-32 chars: letters, digits, dot, underscore, hyphen.",
        )
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if db.query(User).filter_by(username=username).first():
        raise HTTPException(status_code=409, detail="Username is already taken.")

    user = User(username=username, hashed_password=hash_password(body.password))
    db.add(user)
    db.flush()
    _seed_board_for(user, db)
    db.commit()

    _set_session_cookie(response, username)
    return {"username": username}


@router.post("/login")
def login(body: CredentialsBody, response: Response, db: Session = Depends(get_db)):
    user = _authenticate(body.username, body.password, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_session_cookie(response, user.username)
    return {"username": user.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, samesite="strict")
    return {"ok": True}


def require_auth(session: str | None = Cookie(default=None)) -> str:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return signer.unsign(session, max_age=MAX_AGE).decode()
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail="Invalid or expired session")


def require_user(
    username: str = Depends(require_auth),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


@router.get("/me")
def me(user: User = Depends(require_user)):
    return {"username": user.username}


@router.post("/change_password")
def change_password(
    body: ChangePasswordBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.post("/change_username")
def change_username(
    body: ChangeUsernameBody,
    response: Response,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    new_username = body.new_username.strip()
    if not USERNAME_RE.match(new_username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-32 chars: letters, digits, dot, underscore, hyphen.",
        )
    if new_username == user.username:
        return {"username": user.username}
    existing = db.query(User).filter_by(username=new_username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username is already taken.")
    user.username = new_username
    db.commit()
    # Re-sign the session so the cookie carries the new username
    _set_session_cookie(response, new_username)
    return {"username": new_username}


@router.delete("/account")
def delete_account(
    body: DeleteAccountBody,
    response: Response,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Password is incorrect")
    db.delete(user)
    db.commit()
    response.delete_cookie(key=COOKIE_NAME, samesite="strict")
    return {"ok": True}
