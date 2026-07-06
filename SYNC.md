# Working on PC Vault from another PC or account

This project moves between machines by **git**, not by copying the folder.
Copying the folder is what broke things last time: the Python virtual
environment and `.claude/launch.json` had absolute paths baked in from the
other machine (`D:\Web projects\...`, a Python 3.12 path that didn't exist
here), so nothing ran until they were rebuilt.

The rule: **commit and push code; never copy `.venv/`, `node_modules/`,
`.env`, or the database between machines.** Those are all git-ignored on
purpose and must be recreated locally on each PC (steps below).

---

## 0. One-time: put the repo on GitHub (do this once, from this PC)

The repo already exists locally with commits, but it has no remote yet.

1. Create an **empty** repo on GitHub (no README/license) — e.g. `pc-vault`.
   Website → New repository, or if you install the GitHub CLI: `gh repo create pc-vault --private --source . --push`.
2. If you used the website, connect and push from this folder:

   ```bash
   cd "C:\Users\Karthikumar\Pictures\pc-vault"
   git remote add origin https://github.com/<your-username>/pc-vault.git
   git push -u origin main
   ```

That uploads all code and history. `.venv/`, `node_modules/`, `.env`,
`.env.local`, and `*.db` are **not** uploaded (see `.gitignore`) — that's
correct, they're per-machine.

> **Private repo, please.** `.env.example` is safe to share, but keep the
> repo private so nobody copies your deploy notes or opens issues on it.

---

## 1. First time on a NEW PC / account — clone and set up

Prerequisites on the new machine: **Git**, **Python 3.10+**, **Node.js 20+**.
(This project was built and tested on Python 3.11 and Node 24.)

```bash
git clone https://github.com/<your-username>/pc-vault.git
cd pc-vault
```

### Backend (recreate the virtual environment — do NOT copy it)

```bash
cd backend
python -m venv .venv
# Windows PowerShell:  .\.venv\Scripts\Activate.ps1
# Windows CMD:         .\.venv\Scripts\activate.bat
# macOS/Linux:         source .venv/bin/activate
pip install -r requirements.txt

# create the local env file from the template
copy .env.example .env        # Windows      (macOS/Linux: cp .env.example .env)
```

Now edit `backend/.env`. For local dev the defaults are fine (SQLite, open
API), but to match how we've been running it here, set the two dev passwords
so the login + roles work:

```
ADMIN_PASSWORD=vault123
MANAGER_PASSWORD=manager123
```

`FERNET_KEY` already has a working dev key in `.env.example`. Only generate a
new one if you care about the encrypted IP/MAC demo data — and note that a new
key makes any previously-encrypted values unreadable.

Create the database schema and sample data, then run the API:

```bash
alembic upgrade head          # builds all tables incl. the build-approval workflow
python scripts/seed.py        # 3 sample PCs + parts (skip if you don't want demo data)
uvicorn app.main:app --reload --port 8000
```

Check <http://localhost:8000/api/v1/health> → `{"status":"ok"}`.

> The database file (`backend/pcvault.db`) is git-ignored, so a fresh clone
> has **no data** until you run `alembic upgrade head` and (optionally)
> `python scripts/seed.py`. Your data does not travel with the code — that's
> expected. If you want the same data on two machines, use the same MySQL
> database (set `DATABASE_URL` in both `.env` files) rather than SQLite.

### Frontend (recreate `node_modules` — do NOT copy it)

```bash
cd ../frontend
npm install                   # rebuilds node_modules for THIS machine
copy .env.example .env.local  # Windows   (macOS/Linux: cp .env.example .env.local)
npm run dev
```

Open <http://localhost:3000>. Log in with `vault123` (admin) or
`manager123` (manager, view-only + build approvals).

---

## 2. Day-to-day: moving changes between machines

Always **pull before you start**, **push when you finish**:

```bash
# start of a session on any machine
git pull

# ... make changes ...

git add -A
git commit -m "describe what changed"
git push
```

If you edit on two machines without pushing, you'll get merge conflicts.
The habit that avoids all pain: **push before you walk away from a machine.**

### When the schema changes (new migration)

If a pulled change adds an Alembic migration (a new file in
`backend/alembic/versions/`), apply it on each machine after pulling:

```bash
cd backend
alembic upgrade head
```

Skipping this gives "no such column" / "table not found" errors.

### When backend dependencies change

If `backend/requirements.txt` changed after a pull:

```bash
cd backend
pip install -r requirements.txt
```

### When frontend dependencies change

If `frontend/package.json` / `package-lock.json` changed after a pull:

```bash
cd frontend
npm install
```

---

## 3. Things that are NOT in git (recreate per machine)

| Path | What it is | How to recreate |
|---|---|---|
| `backend/.venv/` | Python virtual env (has machine-specific paths) | `python -m venv .venv` + `pip install -r requirements.txt` |
| `backend/.env` | secrets & config | `cp .env.example .env`, then edit |
| `backend/pcvault.db` | local SQLite data | `alembic upgrade head` (+ `seed.py`) |
| `frontend/node_modules/` | installed npm packages | `npm install` |
| `frontend/.env.local` | frontend API URL | `cp .env.example .env.local` |
| `frontend/.next/`, `frontend/out/` | build output | regenerated by `npm run dev` / `npm run build` |
| `.claude/launch.json` | preview-server config (lives outside the repo, under `Pictures/.claude/`) | machine-specific; ignore it |

---

## 4. Gotchas we actually hit (so you don't again)

- **"Python was not found" after cloning** — you copied or reused a `.venv`
  from another machine. Delete `backend/.venv/` and recreate it with this
  machine's Python (`python -m venv .venv` → `pip install -r requirements.txt`).

- **Unstyled page / blue links / "Application error"** — usually the dev
  server's `.next` cache got clobbered (e.g. running `npm run build` while
  `npm run dev` is live — they share `.next`). Stop the dev server, delete
  `frontend/.next`, and run `npm run dev` again. Don't run a production build
  and the dev server at the same time.

- **Port 3000 already in use** — a stale `next dev` from a previous session.
  Find and stop it (Windows PowerShell):
  ```powershell
  Get-NetTCPConnection -LocalPort 3000 -State Listen |
    Select-Object -Expand OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
  ```

- **CORS errors in the browser** — the backend only allows the origin in
  `CORS_ORIGINS` (default `http://localhost:3000`). If you run the frontend on
  a different port, update `CORS_ORIGINS` in `backend/.env` and restart uvicorn.

- **Login says wrong password / API returns 401 everywhere** — you set
  `ADMIN_PASSWORD` in `.env` but the backend was already running. Restart
  uvicorn after editing `.env`. (With no passwords set, auth is disabled and
  the API is open — fine for solo dev, never for production.)

---

## 5. Deploying to cPanel

Local dev sync is separate from going live. For the MilesWeb / cPanel
deployment (database, Passenger Python app, static upload, cron, and the
`ADMIN_PASSWORD` / `MANAGER_PASSWORD` setup), follow **[DEPLOY.md](DEPLOY.md)**.
