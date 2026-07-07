"""Username + password authentication with two roles: admin (full control)
and manager (view + approve).

Accounts live in the `users` table with PBKDF2-hashed passwords. On first
startup the table is bootstrapped from ADMIN_USERNAME/ADMIN_PASSWORD and
MANAGER_USERNAME/MANAGER_PASSWORD; after that the database is the source of
truth and users change their own credentials from the Settings page.

Shared-hosting friendly: no session table, no new dependencies. Logging in
returns an HMAC-signed expiring token carrying the username, role and a
password-version tag — changing your password invalidates every token issued
before the change. If no users exist and no env passwords are set (local dev
default) auth is disabled and every request acts as admin.
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import threading
import time
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import User

PBKDF2_ITERATIONS = 200_000

# brute-force lockout (in-memory; per worker on multi-worker hosts, which
# still slows an attacker by the worker count while staying dependency-free)
LOCKOUT_WINDOW_SECONDS = 15 * 60
MAX_FAILS_PER_USERNAME = 5
MAX_FAILS_PER_IP = 20

Role = Literal["admin", "manager"]

logger = logging.getLogger("pcvault.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def token_ttl_seconds() -> int:
    return settings.session_ttl_days * 24 * 3600


# ── password hashing (stdlib PBKDF2 — no extra deps for shared hosting) ─────

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2:{PBKDF2_ITERATIONS}:{salt.hex()}:{dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, dk_hex = stored.split(":")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(dk.hex(), dk_hex)
    except (ValueError, TypeError):
        return False


def _password_version(password_hash: str) -> str:
    """Short tag baked into tokens; changes whenever the password does."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


# Verified against when the username doesn't exist, so a login attempt takes
# the same time either way — no username enumeration via response timing.
_DUMMY_HASH = hash_password(os.urandom(16).hex())


# ── brute-force lockout ──────────────────────────────────────────────────────

_fail_lock = threading.Lock()
_failures: dict[str, list[float]] = {}


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _recent_failures(key: str, now: float) -> list[float]:
    hits = [t for t in _failures.get(key, []) if now - t < LOCKOUT_WINDOW_SECONDS]
    if hits:
        _failures[key] = hits
    else:
        _failures.pop(key, None)
    return hits


def _check_lockout(username: str, ip: str) -> None:
    now = time.time()
    with _fail_lock:
        user_fails = _recent_failures(f"u:{username.strip().lower()}", now)
        ip_fails = _recent_failures(f"ip:{ip}", now)
        if len(user_fails) >= MAX_FAILS_PER_USERNAME or len(ip_fails) >= MAX_FAILS_PER_IP:
            oldest = min(user_fails + ip_fails)
            retry_after = max(1, int(LOCKOUT_WINDOW_SECONDS - (now - oldest)))
            logger.warning("lockout active for username=%r ip=%s", username, ip)
            raise HTTPException(
                status_code=429,
                detail="Too many failed attempts — try again later.",
                headers={"Retry-After": str(retry_after)},
            )


def _record_failure(username: str, ip: str) -> None:
    now = time.time()
    with _fail_lock:
        _failures.setdefault(f"u:{username.strip().lower()}", []).append(now)
        _failures.setdefault(f"ip:{ip}", []).append(now)


def _clear_failures(username: str) -> None:
    with _fail_lock:
        _failures.pop(f"u:{username.strip().lower()}", None)


# ── user lookup / bootstrap ──────────────────────────────────────────────────

def _find_user(db: Session, username: str) -> Optional[User]:
    return db.execute(
        select(User).where(func.lower(User.username) == username.strip().lower())
    ).scalar_one_or_none()


def _users_exist(db: Session) -> bool:
    return db.execute(select(User.id).limit(1)).scalar_one_or_none() is not None


def bootstrap_users() -> None:
    """Create the initial accounts from env vars if the table is empty.
    Called once at app startup."""
    db = SessionLocal()
    try:
        if _users_exist(db):
            return
        if settings.admin_password:
            db.add(User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                role="admin",
            ))
        if settings.manager_password:
            db.add(User(
                username=settings.manager_username,
                password_hash=hash_password(settings.manager_password),
                role="manager",
            ))
        db.commit()
    finally:
        db.close()


def _auth_enabled(db: Session) -> bool:
    return _users_exist(db) or bool(
        settings.admin_password or settings.manager_password
    )


def manager_role_enabled() -> bool:
    """Approval workflow is enforced only when a manager account exists."""
    db = SessionLocal()
    try:
        has_manager = db.execute(
            select(User.id).where(User.role == "manager").limit(1)
        ).scalar_one_or_none() is not None
        return has_manager or bool(settings.manager_password)
    finally:
        db.close()


# ── tokens ───────────────────────────────────────────────────────────────────

def _secret() -> bytes:
    return hashlib.sha256(f"pc-vault-auth:{settings.fernet_key}".encode()).digest()


def _sign(payload: bytes) -> str:
    return hmac.new(_secret(), payload, hashlib.sha256).hexdigest()


def create_token(user: User) -> str:
    payload = json.dumps({
        "exp": int(time.time()) + token_ttl_seconds(),
        "role": user.role,
        "u": user.username,
        "pv": _password_version(user.password_hash),
    }).encode()
    b64 = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{b64}.{_sign(payload)}"


def _decode_token(db: Session, token: str) -> Optional[User]:
    """Return the token's user if signature, expiry and password version
    all check out."""
    try:
        b64, signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4))
        if not hmac.compare_digest(_sign(payload), signature):
            return None
        data = json.loads(payload)
        if data["exp"] <= time.time():
            return None
        user = _find_user(db, data["u"])
        if user is None or user.role != data.get("role"):
            return None
        # stale after a password change — force a fresh login
        if data.get("pv") != _password_version(user.password_hash):
            return None
        return user
    except (ValueError, KeyError, TypeError):
        return None


def _request_user(request: Request, db: Session) -> Optional[User]:
    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ").strip()
    if not token and request.method == "GET":
        # query-param tokens exist only for <img>/<a download> tags that
        # can't send headers — never accept them on state-changing requests
        token = request.query_params.get("token", "")
    return _decode_token(db, token) if token else None


def _resolve_role(request: Request) -> Optional[Role]:
    db = SessionLocal()
    try:
        if not _auth_enabled(db):
            return "admin"  # dev mode: open API, full rights
        user = _request_user(request, db)
        return user.role if user else None  # type: ignore[return-value]
    finally:
        db.close()


def require_auth(request: Request) -> Role:
    """Any logged-in role. Token via `Authorization: Bearer` or, for plain
    <img>/<a download> tags that can't send headers, a `?token=` query param."""
    role = _resolve_role(request)
    if role is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return role


def require_admin(request: Request) -> Role:
    role = require_auth(request)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return role


def require_manager(request: Request) -> Role:
    role = require_auth(request)
    if role != "manager":
        raise HTTPException(status_code=403, detail="Only the manager can do this")
    return role


# ── endpoints ────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1)


class LoginOut(BaseModel):
    token: str
    role: Role
    username: str
    expires_in: int = Field(default_factory=token_ttl_seconds)


class AuthStatusOut(BaseModel):
    auth_required: bool
    manager_enabled: bool


class MeOut(BaseModel):
    role: Role
    username: str


class ProfileUpdateIn(BaseModel):
    current_password: str = Field(min_length=1)
    username: Optional[str] = Field(default=None, min_length=3, max_length=80)
    new_password: Optional[str] = Field(default=None, min_length=8, max_length=128)


@router.get("/status", response_model=AuthStatusOut)
def auth_status(db: Session = Depends(get_db)):
    return AuthStatusOut(
        auth_required=_auth_enabled(db), manager_enabled=manager_role_enabled()
    )


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    if not _auth_enabled(db):
        raise HTTPException(status_code=400, detail="Authentication is disabled")
    ip = _client_ip(request)
    _check_lockout(payload.username, ip)
    user = _find_user(db, payload.username)
    if user is None:
        # burn the same PBKDF2 time as a real check — no timing enumeration
        verify_password(payload.password, _DUMMY_HASH)
    if user is None or not verify_password(payload.password, user.password_hash):
        _record_failure(payload.username, ip)
        logger.warning("failed login for username=%r ip=%s", payload.username, ip)
        # same error either way — don't reveal which usernames exist
        raise HTTPException(status_code=401, detail="Wrong username or password")
    _clear_failures(payload.username)
    logger.info("login ok user=%r role=%s ip=%s", user.username, user.role, ip)
    return LoginOut(token=create_token(user), role=user.role, username=user.username)


@router.get("/me", response_model=MeOut)
def me(request: Request, db: Session = Depends(get_db)):
    if not _auth_enabled(db):
        return MeOut(role="admin", username="admin")
    user = _request_user(request, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return MeOut(role=user.role, username=user.username)


@router.patch("/profile", response_model=LoginOut)
def update_profile(payload: ProfileUpdateIn, request: Request, db: Session = Depends(get_db)):
    """Change your own username and/or password. Always requires the current
    password; returns a fresh token because the old one stops working the
    moment the password changes."""
    if not _auth_enabled(db):
        raise HTTPException(status_code=400, detail="Authentication is disabled")
    user = _request_user(request, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=403, detail="Current password is wrong")
    if payload.username is None and payload.new_password is None:
        raise HTTPException(status_code=422, detail="Nothing to change")

    if payload.username is not None:
        new_name = payload.username.strip()
        if len(new_name) < 3:
            raise HTTPException(status_code=422, detail="Username must be at least 3 characters")
        existing = _find_user(db, new_name)
        if existing is not None and existing.id != user.id:
            raise HTTPException(status_code=409, detail="That username is taken")
        user.username = new_name
    if payload.new_password is not None:
        user.password_hash = hash_password(payload.new_password)
        logger.info("password changed for user=%r", user.username)

    db.add(user)
    db.commit()
    db.refresh(user)
    return LoginOut(token=create_token(user), role=user.role, username=user.username)
