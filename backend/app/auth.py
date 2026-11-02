"""Opaque, revocable administrator sessions. No runtime default account."""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import get_db
from app.models import Admin, AdminSession, LoginBucket

hasher = PasswordHasher()
# Equal-cost verification for unknown users, never a usable account password.
_dummy_hash = hasher.hash(secrets.token_urlsafe(48))
router = APIRouter(prefix="/api/auth", tags=["Administrator authentication"])
Db = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_settings)]


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def cookie_name(settings):
    return "__Host-knowledgeos_session" if settings.auth_cookie_secure else "knowledgeos_session"


def csrf_for(token):
    return hmac.new(token.encode(), b"knowledgeos-csrf-v1", hashlib.sha256).hexdigest()


def check_origin(request, settings):
    if request.headers.get("origin") not in settings.cors_origins:
        raise HTTPException(403, "Request origin is not allowed")


def session_context(request, db, settings):
    token = request.cookies.get(cookie_name(settings), "")
    if not 32 <= len(token) <= 128:
        raise HTTPException(401, "Administrator authentication required")
    session = db.get(AdminSession, digest(token))
    now = datetime.now(timezone.utc)
    if session is None or session.expires_at.replace(tzinfo=timezone.utc) <= now:
        raise HTTPException(401, "Administrator authentication required")
    admin = db.get(Admin, session.admin_id)
    if admin is None or not admin.enabled:
        raise HTTPException(401, "Administrator authentication required")
    return admin, session, token


def require_admin(request: Request, db: Db, settings: Config):
    if request.url.path == "/api/health" and request.method == "GET":
        return None
    admin, session, token = session_context(request, db, settings)
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        check_origin(request, settings)
        if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), csrf_for(token)):
            raise HTTPException(403, "CSRF verification failed")
    request.state.admin_id = admin.id
    return admin


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=1024)


def limit_login(db, request, username):
    """Atomic fixed windows shared across workers; never trust client Forwarded headers."""
    now = datetime.now(timezone.utc)
    window = int(now.timestamp()) // 900
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    exceeded = False
    for scope, value, limit in [("account", username, 5), ("ip", request.client.host if request.client else "unknown", 20)]:
        key = digest(f"{scope}:{value}:{window}")
        stmt = insert(LoginBucket).values(id=key, attempts=1, expires_at=now + timedelta(minutes=30))
        stmt = stmt.on_conflict_do_update(index_elements=[LoginBucket.id], set_={"attempts": LoginBucket.attempts + 1})
        count = db.execute(stmt.returning(LoginBucket.attempts)).scalar_one()
        exceeded |= count > limit
    db.execute(delete(LoginBucket).where(LoginBucket.expires_at < now))
    db.commit()
    if exceeded:
        raise HTTPException(429, "Too many login attempts. Try again later.", headers={"Retry-After": "900"})


@router.post("/login")
def login(body: LoginInput, request: Request, response: Response, db: Db, settings: Config):
    check_origin(request, settings)
    username = body.username.strip().lower()
    limit_login(db, request, username)
    admin = db.scalar(select(Admin).where(Admin.username == username))
    try:
        valid = hasher.verify(admin.password_hash if admin else _dummy_hash, body.password)
    except (VerificationError, InvalidHashError):
        valid = False
    if not valid or admin is None or not admin.enabled:
        raise HTTPException(401, "Invalid username or password")
    if hasher.check_needs_rehash(admin.password_hash):
        admin.password_hash = hasher.hash(body.password)
    old = request.cookies.get(cookie_name(settings), "")
    if old:
        db.execute(delete(AdminSession).where(AdminSession.token_hash == digest(old)))
    now = datetime.now(timezone.utc)
    db.execute(delete(AdminSession).where(AdminSession.expires_at < now))
    token = secrets.token_urlsafe(32)
    db.add(AdminSession(token_hash=digest(token), admin_id=admin.id, expires_at=now + timedelta(hours=settings.admin_session_hours)))
    db.commit()
    response.set_cookie(
        cookie_name(settings),
        token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="strict",
        path="/",
        max_age=settings.admin_session_hours * 3600,
    )
    response.headers["Cache-Control"] = "no-store"
    return {"id": admin.id, "username": admin.username, "csrf_token": csrf_for(token)}


@router.get("/me")
def me(request: Request, response: Response, db: Db, settings: Config):
    admin, _, token = session_context(request, db, settings)
    response.headers["Cache-Control"] = "no-store"
    return {"id": admin.id, "username": admin.username, "csrf_token": csrf_for(token)}


@router.post("/logout", dependencies=[Depends(require_admin)])
def logout(request: Request, response: Response, db: Db, settings: Config):
    token = request.cookies.get(cookie_name(settings), "")
    db.execute(delete(AdminSession).where(AdminSession.token_hash == digest(token)))
    db.commit()
    response.delete_cookie(cookie_name(settings), path="/", secure=settings.auth_cookie_secure, httponly=True, samesite="strict")
    response.headers["Cache-Control"] = "no-store"
    return {"logged_out": True}
