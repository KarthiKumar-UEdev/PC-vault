"""Phusion Passenger entrypoint for cPanel shared hosting.

Passenger speaks WSGI; FastAPI is ASGI. a2wsgi bridges the two so the app
runs inside cPanel's "Setup Python App" without any long-lived server
process of our own (Passenger manages workers, spawning and killing them
as traffic demands — which is also why APScheduler-style in-process
schedulers don't work here; cron scripts do).
"""
import os
import sys

# Ensure the application root (this directory) is importable regardless of
# the working directory Passenger launches us from.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from a2wsgi import ASGIMiddleware  # noqa: E402

from app.main import app  # noqa: E402

application = ASGIMiddleware(app)
