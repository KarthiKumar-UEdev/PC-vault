"""Single-admin authentication.

Shared-hosting friendly: no session table, no new dependencies. Logging in
with ADMIN_PASSWORD returns an HMAC-signed expiring token derived from
FERNET_KEY; every protected route verifies it statelessly.

If ADMIN_PASSWORD is unset (local dev default) auth is disabled and the API
behaves exactly as before.
"""
import base64
import hashlib
import hmac
import json
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings

TOKEN_TTL_SECONDS = 30 * 24 * 3600  # 30 days

router = APIRouter(prefix="/auth", tags=["auth"])


def _secret() -> bytes:
    return hashlib.sha256(f"pc-vault-auth:{settings.fernet_key}".encode()).digest()


def _sign(payload: bytes) -> str:
    return hmac.new(_secret(), payload, hashlib.sha256).hexdigest()


def create_token() -> str:
    payload = json.dumps({"exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode()
    b64 = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{b64}.{_sign(payload)}"


def verify_token(token: str) -> bool:
    try:
        b64, signature = token.split(".", 1)
        payload = base64.urlsafe_b64decode(b64 + "=" * (-len(b64) % 4))
        if not hmac.compare_digest(_sign(payload), signature):
            return False
        return json.loads(payload)["exp"] > time.time()
    except (ValueError, KeyError, TypeError):
        return False


def require_auth(request: Request) -> None:
    """FastAPI dependency guarding protected routers.

    Accepts the token as `Authorization: Bearer <token>` or, for plain
    <img>/<a download> tags that can't send headers, as a `?token=` query
    parameter.
    """
    if not settings.admin_password:
        return  # auth disabled
    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ").strip() or request.query_params.get("token", "")
    if not token or not verify_token(token):
        raise HTTPException(status_code=401, detail="Not authenticated")


class LoginIn(BaseModel):
    password: str


class LoginOut(BaseModel):
    token: str
    expires_in: int = TOKEN_TTL_SECONDS


class AuthStatusOut(BaseModel):
    auth_required: bool


@router.get("/status", response_model=AuthStatusOut)
def auth_status():
    return AuthStatusOut(auth_required=bool(settings.admin_password))


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn):
    if not settings.admin_password:
        raise HTTPException(status_code=400, detail="Authentication is disabled")
    if not hmac.compare_digest(payload.password, settings.admin_password):
        raise HTTPException(status_code=401, detail="Wrong password")
    return LoginOut(token=create_token())
