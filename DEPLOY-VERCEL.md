# Deploying PC Vault on Vercel

Vercel runs the backend as **serverless functions** — there is no always-on
server and **no disk that survives between requests**. That has two hard
consequences:

1. **SQLite cannot work on Vercel.** The `pcvault.db` file would vanish on
   every request. You need a *hosted* database (free tiers exist).
2. Anything that relies on a long-running process degrades (details in
   "Limitations" below) — acceptable for this app, but know about it.

If you'd rather run a classic server (simpler mental model), deploy the
backend to **Render / Railway / Fly.io** or the original **cPanel** plan
([DEPLOY.md](DEPLOY.md)) and keep only the frontend on Vercel.

---

## Architecture

```
Browser ──► Vercel project #1: frontend  (Next.js static export)
                │  NEXT_PUBLIC_API_URL
                ▼
            Vercel project #2: backend   (FastAPI via api/index.py)
                │  DATABASE_URL
                ▼
            Neon / Supabase Postgres  or  hosted MySQL   (the real store)
```

Two separate Vercel projects from the **same GitHub repo**, different root
directories.

## Step 1 — Create the database (Neon, free)

1. <https://neon.tech> → new project → copy the **connection string**
   (`postgresql://user:pass@...neon.tech/neondb?sslmode=require`).
   Postgres support is built in — the URL is normalized to the psycopg2
   driver automatically. A hosted MySQL works too
   (`mysql+pymysql://...`).
2. **Create the tables from your PC** — Vercel can't run alembic for you:

   ```powershell
   cd backend
   .venv\Scripts\activate
   $env:DATABASE_URL = "postgresql://...your neon url..."
   alembic upgrade head
   ```

## Step 2 — Backend project on Vercel

1. Vercel → **Add New Project** → import `PC-vault` → set
   **Root Directory = `backend`**. The included `backend/vercel.json` and
   `backend/api/index.py` do the rest (all routes → FastAPI).
2. Environment variables (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon/MySQL URL from step 1 |
   | `FERNET_KEY` | freshly generated — `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
   | `ADMIN_USERNAME` / `ADMIN_PASSWORD` | bootstrap admin (strong password!) |
   | `MANAGER_USERNAME` / `MANAGER_PASSWORD` | optional manager account |
   | `FRONTEND_URL` | the frontend URL from step 3, e.g. `https://pc-vault.vercel.app` |
   | `CORS_ORIGINS` | same frontend URL (comma-separate if several) |

3. Deploy, then open `https://<backend>.vercel.app/api/v1/health` →
   `{"status":"ok"}`.

## Step 3 — Frontend project on Vercel

1. **Add New Project** again, same repo → **Root Directory = `frontend`**.
2. Environment variable: `NEXT_PUBLIC_API_URL = https://<backend>.vercel.app`
   (no trailing slash).
3. Deploy → open the site → you should land on the login page. Log in with
   the bootstrap admin.

If you created the frontend first, go back and fill `FRONTEND_URL` /
`CORS_ORIGINS` on the backend project, then redeploy the backend — a wrong
`CORS_ORIGINS` is the #1 cause of "Failed to fetch" on the login screen.

## Step 4 — After it's live

Same checklist as [SETUP.md](SETUP.md) §4: rotate the bootstrap password
from Settings, add users, add employees, register assets.

To manage users against the production DB from your PC:

```powershell
cd backend
$env:DATABASE_URL = "postgresql://...neon url..."
python scripts/manage_users.py list
```

---

## Limitations on serverless (and what to do)

| Thing | On Vercel | Mitigation |
|---|---|---|
| Login brute-force lockout | counted **per function instance**, so it's weaker than on a real server | Neon-side rate limits / Vercel WAF; password strength matters most |
| Warranty alert cron | no local cron; `scripts/send_warranty_alerts.py` can't run on Vercel | run it from any PC / GitHub Actions on a schedule, pointing `DATABASE_URL` at the hosted DB |
| Cold starts | first request after idle takes 1–3 s | normal; Neon also wakes from idle |
| Bootstrap timing | runs on each cold start (no-op once users exist); if the DB isn't migrated yet the API still boots and logs a warning | run `alembic upgrade head` (step 1) before first use |

## Common failures

| Symptom | Cause |
|---|---|
| Build succeeds, every request 500s | `DATABASE_URL` missing/wrong, or tables not created (`alembic upgrade head`) |
| `Failed to fetch` at login | `CORS_ORIGINS` doesn't include the frontend's exact origin |
| Login says wrong password on first try | bootstrap ran before env vars were set — check `manage_users.py list` against the prod DB, add the admin manually if empty |
| Works, then random `SSL connection closed` | stale pooled connections — shouldn't happen (NullPool is automatic on Vercel); make sure `VERCEL` env var exists (Vercel sets it itself) |
