# PC Vault — Users, Passwords & Deploy Checklist

How to set up your list of users, and everything that must happen **before**
and **after** a deployment (database tables, env vars, first login).
For the full cPanel walkthrough see [DEPLOY.md](DEPLOY.md); for Vercel +
hosted Postgres see [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md); for syncing the
project to another dev machine see [SYNC.md](SYNC.md).

---

## 1. How logins work

- Accounts live in the **`users` database table**. Passwords are stored
  **PBKDF2-hashed** (200k iterations, per-user salt) — never as plain text.
- Two roles:

  | Role | Can do |
  |---|---|
  | `admin` | everything — PCs, assets, employees, builds, convert to PC |
  | `manager` | view everything + approve/reject planned builds + comment |

- Logging in returns a signed token that lives in the browser for **30 days**.
  Changing a password **instantly invalidates** that user's old sessions on
  every device.
- Usernames are matched case-insensitively (`karthi kumar` = `Karthi Kumar`).
- If the `users` table is empty **and** no bootstrap passwords are set, auth
  is disabled and the whole app acts as admin — fine for local dev, never for
  production.

## 2. Setting up your list of users

### First accounts (bootstrap, one time)

On the very first startup with an empty `users` table, the backend creates
accounts from these env vars (in `backend/.env` locally, or cPanel
environment variables in production):

```
ADMIN_USERNAME=Karthi Kumar
ADMIN_PASSWORD=ctpl
MANAGER_USERNAME=manager
MANAGER_PASSWORD=manager123
```

After that first startup these values are **ignored forever** — the database
is the source of truth. Editing them later does nothing; use the Settings
page or the CLI below instead.

### Day-to-day: the Settings page

Every logged-in user can change **their own** username and password from
**Settings** (click your name at the bottom of the sidebar). Requires the
current password.

### Full control: the `manage_users.py` CLI

Run from `backend/` with the venv active (locally) or via SSH on the server.
This is also your **forgot-password recovery** — it talks straight to the
database, no login needed.

```bash
python scripts/manage_users.py list                                  # show all accounts
python scripts/manage_users.py add "Priya" --role admin              # prompts for password
python scripts/manage_users.py add "reviewer" --role manager --password s3cret
python scripts/manage_users.py set-password "Karthi Kumar"           # reset (hidden prompt)
python scripts/manage_users.py set-role reviewer admin               # promote / demote
python scripts/manage_users.py rename "Old Name" "New Name"
python scripts/manage_users.py delete reviewer                       # refuses to delete the last admin
```

You can have as many admins and managers as you like. The approval workflow
("builds need manager sign-off before becoming a real PC") turns on
automatically as soon as **any** manager account exists.

> **Users vs Employees:** `users` are *logins* for this app (usually just a
> couple of people). *Employees* on the Team page are the people you assign
> laptops/PCs to — they don't log in. They're separate lists on purpose.

---

## 3. Before deploying

Do these in order — the app won't start correctly without them.

### 3.1 Database

1. Create the MySQL database + DB user in cPanel (**MySQL Databases**),
   grant ALL PRIVILEGES.
2. Set `DATABASE_URL` (see env table below).
3. **Create the tables** — from `backend/` on the server:

   ```bash
   alembic upgrade head
   ```

   This builds/updates every table. Current schema:

   | Table | What it holds |
   |---|---|
   | `users` | login accounts (hashed passwords, roles) |
   | `employees` | your team — who uses which PC/laptop |
   | `pcs` | machines (+ `employee_id` = who uses it) |
   | `parts` | all assets: components, laptops, monitors, VR, network gear |
   | `network_info` | per-PC IP/MAC, Fernet-encrypted at rest |
   | `transfer_logs` | audit trail of every part movement |
   | `planned_builds`, `planned_build_items`, `build_comments` | the planner + approval workflow |
   | `alembic_version` | migration bookkeeping — never touch |

   Re-run `alembic upgrade head` after **every** code update — new features
   often ship with a migration (e.g. employees, users, new asset types).

### 3.2 Environment variables (backend)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `mysql+pymysql://USER:PASS@localhost:3306/DBNAME` |
| `FERNET_KEY` | ✅ | generate fresh: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` — never the example key |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | ✅ | bootstrap admin — **use a strong password in production**, you can rotate it from Settings afterwards |
| `MANAGER_USERNAME` / `MANAGER_PASSWORD` | optional | bootstrap manager; enables the approval workflow |
| `FRONTEND_URL` | ✅ | public site URL — printed inside QR codes |
| `CORS_ORIGINS` | ✅ | comma-separated origins allowed to call the API |
| `SESSION_TTL_DAYS` | optional | how long logins stay valid — default 30, use `7` for stricter production |
| `SMTP_*`, `ALERT_EMAIL_TO`, `WARRANTY_ALERT_DAYS` | optional | only for the warranty alert email script |

### 3.3 Frontend build

```bash
cd frontend
# .env.production → NEXT_PUBLIC_API_URL=https://yourdomain.com  (or wherever the API lives)
npm run build      # static export lands in frontend/out/ → upload to public_html
```

⚠️ Never run `npm run build` while a dev server is running from the same
folder — it corrupts the dev server's cache (delete `.next/` and restart if
you did).

---

## 4. After deploying

1. **Health check** — `https://yourdomain.com/api/v1/health` should return
   `{"status":"ok"}`. The bare API root (`/`) shows a friendly pointer, and
   interactive docs live at `/api/v1/docs`.
2. **First login** — use the bootstrap admin credentials. If login fails,
   the backend probably started before the env vars were set: check
   `python scripts/manage_users.py list` via SSH.
3. **Rotate the bootstrap passwords** — Settings page, or the CLI. Do this
   immediately if the bootstrap password was weak (e.g. `ctpl`).
4. **Add the rest of your users** — `manage_users.py add ...` (section 2).
5. **Add your team** — Team page → *Add employee*, then assign laptops/PCs.
6. **Register assets** — Asset Vault → *Register asset* (components,
   laptops, monitors, VR headsets, routers, switches…). Network gear
   automatically appears on the **Network** page topology.
7. **Warranty alert emails** (optional) — cPanel cron, e.g. daily 08:00:

   ```
   /home/USER/virtualenv/.../bin/python /home/USER/pc-vault-backend/scripts/send_warranty_alerts.py
   ```

8. **Backups** — schedule a regular dump of the MySQL database; it contains
   everything (including user accounts). The Fernet key is **not** in the
   database — back up the env vars too, or encrypted IP/MAC data is lost.

### Upgrading an existing deployment

```bash
# backend
git pull / upload new code
alembic upgrade head        # ← the step people forget; new tables/columns
restart the Python app (cPanel → Setup Python App → Restart)

# frontend
npm run build → upload frontend/out/
```

---

## 5. Security — what's built in, what you must do

### Built into the app

- **Passwords** — PBKDF2-hashed (200k iterations, per-user salt), never
  stored or logged in plain text. New passwords must be **8+ characters**.
- **Brute-force lockout** — 5 failed logins for a username (or 20 from one
  IP) inside 15 minutes → login blocked with `429 Too Many Requests` until
  the window passes. Failures are also written to the server log.
- **No username enumeration** — wrong username and wrong password return the
  identical error in identical time.
- **Session tokens** — HMAC-signed, expire after `SESSION_TTL_DAYS`, and die
  instantly when the password changes. Query-string tokens (used only for QR
  `<img>` tags) are accepted on read-only GET requests, never on writes.
- **Security headers** — API sends `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store` and
  a deny-all CSP on JSON responses; HSTS when served over HTTPS. The
  frontend `.htaccess` sets the same family of headers and **redirects all
  production traffic to HTTPS**.
- **Encrypted at rest** — IP/MAC addresses are Fernet-encrypted before they
  touch the database.
- **Audit trail** — logins (ok/failed/locked-out) and password changes are
  logged with username + IP; part movements are in `transfer_logs`.

### Your checklist (the app can't do these for you)

1. **Strong, unique admin password** — 8+ chars is the floor, not the goal.
   Rotate the bootstrap password right after the first login.
2. **Real `FERNET_KEY`** — the app logs a warning at startup if the insecure
   dev key is used with auth enabled. Generate one per environment and never
   reuse the dev key in production.
3. **HTTPS with a valid certificate** — free AutoSSL in cPanel. The QR
   scanner also requires HTTPS for camera access.
4. **`SESSION_TTL_DAYS=7`** in production if the vault holds sensitive
   network data.
5. **Keep `CORS_ORIGINS` exact** — only your real domain(s), never `*`.
6. **Don't expose the API docs publicly if you don't need them** — they're
   read-only but reveal the API surface (`/api/v1/docs`).
7. **Backups + key custody** — DB dump on a schedule, env vars (especially
   `FERNET_KEY`) stored somewhere safe outside the server.

> Known limit of shared hosting: the login lockout counter is per Python
> worker process, so on multi-worker Passenger setups an attacker gets
> `5 × workers` attempts per window instead of exactly 5 — still far too few
> for brute force against an 8+ character password.

---

## 6. Quick reference — local dev

```bash
# backend  (creates Karthi Kumar/ctpl + manager/manager123 on first run)
cd backend && .venv\Scripts\activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend && npm run dev          # http://localhost:3000
```
