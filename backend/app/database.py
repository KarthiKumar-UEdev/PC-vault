import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.config import settings


def _normalize_url(url: str) -> str:
    """Accept the URL formats hosted DBs hand out (Neon/Supabase/Heroku give
    postgres:// or postgresql://) and pin them to the psycopg2 driver."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


DATABASE_URL = _normalize_url(settings.database_url)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Serverless platforms (Vercel/Lambda) freeze processes between requests —
# pooled connections go stale and pile up on the DB. One connection per
# request via NullPool is the safe shape there; classic servers keep a pool.
_serverless = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **(
        {"poolclass": NullPool}
        if _serverless
        else {
            "pool_pre_ping": True,   # shared-host MySQL closes idle connections
            "pool_recycle": 280,
        }
    ),
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
