"""Two-role authentication: admin (full control) and manager (view + approve).

Shared-hosting friendly: no session table, no new dependencies. Logging in
with ADMIN_PASSWORD or MANAGER_PASSWORD returns an HMAC-signed expiring
token that carries the role; every protected route verifies it statelessly.

If neither password is set (local dev default) auth is disabled and every
request acts as admin.
"""
import base64
import hashlib
import hmac
import json
import time
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings

TOKEN_TTL_SECONDS = 30 * 24 * 3600  # 30 days

Role = Literal["admin", "manager"]

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_enabled() -> bool:
    return bool(settings.admin_password or settings.manager_password)


def _secret() -> bytes:
    return hashlib.sha256(f"pc-vault-auth:{settings.fernet_key}".encode()).digest()


def _sign(payload: bytes) -> str:
    return hmac.new(_secret(), payload, hashlib.sha256).hexdigest()


def create_token(role: Role) -> str:
    payload = json.dumps({"exp": int(time.time()) + TOKEN_TTL_SECONDS, "role": role}).encode()
    b64 = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{b64}.{_sign(payload)}"


def _decode_token(token: str) -> Optional[Role]:
    """Return the token's role if the signature and expiry check out."""
    try:
        b64, signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4))
        if not hmac.compare_digest(_sign(payload), signature):
            return None
        data = json.loads(payload)
        if data["exp"] <= time.time():
            return None
        role = data.get("role", "admin")
        return role if role in ("admin", "manager") else None
    except (ValueError, KeyError, TypeError):
        return None


def _request_role(request: Request) -> Optional[Role]:
    if not _auth_enabled():
        return "admin"  # dev mode: open API, full rights
    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ").strip() or request.query_params.get("token", "")
    return _decode_token(token) if token else None


def require_auth(request: Request) -> Role:
    """Any logged-in role. Token via `Authorization: Bearer` or, for plain
    <img>/<a download> tags that can't send headers, a `?token=` query param."""
    role = _request_role(request)
    if role is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return role


def require_admin(request: Request) -> Role:
    role = _request_role(request)
    if role is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return role


def require_manager(request: Request) -> Role:
    role = _request_role(request)
    if role is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if role != "manager":
        raise HTTPException(status_code=403, detail="Only the manager can do this")
    return role


def manager_role_enabled() -> bool:
    """Approval workflow is enforced only when a manager account exists."""
    return bool(settings.manager_password)


class LoginIn(BaseModel):
    password: str


class LoginOut(BaseModel):
    token: str
    role: Role
    expires_in: int = TOKEN_TTL_SECONDS


class AuthStatusOut(BaseModel):
    auth_required: bool
    manager_enabled: bool


class MeOut(BaseModel):
    role: Role


@router.get("/status", response_model=AuthStatusOut)
def auth_status():
    return AuthStatusOut(auth_required=_auth_enabled(), manager_enabled=manager_role_enabled())


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn):
    if not _auth_enabled():
        raise HTTPException(status_code=400, detail="Authentication is disabled")
    if settings.admin_password and hmac.compare_digest(payload.password, settings.admin_password):
        return LoginOut(token=create_token("admin"), role="admin")
    if settings.manager_password and hmac.compare_digest(payload.password, settings.manager_password):
        return LoginOut(token=create_token("manager"), role="manager")
    raise HTTPException(status_code=401, detail="Wrong password")


@router.get("/me", response_model=MeOut)
def me(request: Request):
    return MeOut(role=require_auth(request))
