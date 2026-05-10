import os
from fastapi import APIRouter, Cookie, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-do-not-use-in-prod")
CREDENTIALS = {"user": "password"}
COOKIE_NAME = "session"
MAX_AGE = 60 * 60 * 24  # 24 hours

signer = TimestampSigner(SECRET_KEY)


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, response: Response):
    expected = CREDENTIALS.get(body.username)
    if expected is None or expected != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = signer.sign(body.username).decode()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="strict",
        max_age=MAX_AGE,
    )
    return {"username": body.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, samesite="strict")
    return {"ok": True}


@router.get("/me")
def me(session: str | None = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        username = signer.unsign(session, max_age=MAX_AGE).decode()
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return {"username": username}
