from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fastapi import Depends

from app.auth import require_auth
from app.auth import router as auth_router
from app.config import settings
from app.routers import alerts, builds, network, parts, pcs, stats

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
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
PROTECTED = [Depends(require_auth)]

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


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "pc-vault"}
