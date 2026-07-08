"""Vercel serverless entry point.

Vercel's Python runtime looks for an ASGI `app` in api/*.py and routes every
request here via the rewrite in vercel.json. Lifespan/startup events don't
fire in this runtime, so the bootstrap runs at import (each cold start —
it's a no-op once users exist).
"""
from app.main import app, run_startup_checks

run_startup_checks()

__all__ = ["app"]
