import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.auth import bootstrap_users, require_auth
from app.auth import router as auth_router
from app.config import _INSECURE_DEV_KEY, settings
from app.routers import alerts, builds, employees, network, parts, pcs, stats

logger = logging.getLogger("pcvault")

app = FastAPI(
    title="PC Vault API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    # API responses carry tokens/inventory data — never cache them anywhere
    if request.url.path.startswith("/api/") and "/docs" not in request.url.path:
        response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'")
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response

API_PREFIX = "/api/v1"
PROTECTED = [Depends(require_auth)]


@app.on_event("startup")
def _bootstrap_users() -> None:
    """First run only: create admin/manager accounts from env vars."""
    bootstrap_users()
    if settings.fernet_key == _INSECURE_DEV_KEY and (
        settings.admin_password or settings.manager_password
    ):
        logger.warning(
            "FERNET_KEY is the insecure dev default — login tokens and "
            "encrypted network info are NOT safe. Set a real key in production "
            "(see SETUP.md)."
        )

# Public: login + QR landing lookup (scanned tags open without a session).
# public_router must register before pcs.router so /pcs/qr/... wins over /pcs/{pc_id}.
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(pcs.public_router, prefix=API_PREFIX)

# Everything else requires a token once ADMIN_PASSWORD is set.
app.include_router(pcs.router, prefix=API_PREFIX, dependencies=PROTECTED)
app.include_router(parts.router, prefix=API_PREFIX, dependencies=PROTECTED)
app.include_router(network.router, prefix=API_PREFIX, dependencies=PROTECTED)
app.include_router(builds.router, prefix=API_PREFIX, dependencies=PROTECTED)
app.include_router(alerts.router, prefix=API_PREFIX, dependencies=PROTECTED)
app.include_router(stats.router, prefix=API_PREFIX, dependencies=PROTECTED)
app.include_router(employees.router, prefix=API_PREFIX, dependencies=PROTECTED)


@app.get("/", include_in_schema=False)
def root():
    """Friendly landing so opening the API host in a browser isn't a bare 404."""
    return {
        "service": "pc-vault-api",
        "hint": "This is the API server - the app UI is the frontend site.",
        "docs": "/api/v1/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "pc-vault"}
