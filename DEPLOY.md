# Deploying PC Vault to MilesWeb shared cPanel hosting

Architecture on shared hosting:

| Piece | Where it lives | Served by |
|---|---|---|
| Frontend (static export) | `public_html/` | Apache |
| FastAPI backend | `~/pcvault-api/` (outside `public_html`) | Phusion Passenger ("Setup Python App"), mounted at `/api` or an `api.` subdomain |
| MySQL database | cPanel → MySQL Databases | MariaDB/MySQL |
| Warranty emails | `scripts/send_warranty_alerts.py` | cPanel Cron Jobs |

Throughout this guide replace:

- `USER` — your cPanel username
- `yourdomain.com` — your domain
- Paths assume the backend is uploaded to `/home/USER/pcvault-api`

---

## 1. Create the MySQL database and user

1. cPanel → **MySQL® Databases**.
2. Under *Create New Database*: name `pcvault` → **Create Database**.
   cPanel prefixes it, so the real name becomes `USER_pcvault`.
3. Under *MySQL Users → Add New User*: username `pcvault` (becomes
   `USER_pcvault`), generate a strong password and **save it** → **Create User**.
4. Under *Add User To Database*: select user `USER_pcvault` + database
   `USER_pcvault` → **Add** → on the privileges screen check **ALL PRIVILEGES**
   → **Make Changes**.
5. Your connection string is:

   ```
   mysql+pymysql://USER_pcvault:DB_PASSWORD@localhost:3306/USER_pcvault
   ```

   On shared hosting the DB host is almost always `localhost`.

## 2. Upload the backend and create the Python app

### Upload

1. Zip the `backend/` folder locally (exclude `.venv/`, `__pycache__/`, `.env`,
   `pcvault.db`).
2. cPanel → **File Manager** → your home directory (NOT `public_html`) →
   **Upload** the zip → right-click → **Extract** → rename the folder to
   `pcvault-api`. You should have `/home/USER/pcvault-api/passenger_wsgi.py`.

### Create the app

3. cPanel → **Setup Python App** → **Create Application**:
   - **Python version**: newest available 3.10+ (3.10/3.11/3.12 all work)
   - **Application root**: `pcvault-api`
   - **Application URL**: choose ONE:
     - `yourdomain.com` + URL path `/api` (frontend and API share the domain), or
     - an `api.yourdomain.com` subdomain (create it first under cPanel → Domains)
   - **Application startup file**: `passenger_wsgi.py`
   - **Application Entry point**: `application`
   - **Create**.
4. Install dependencies. At the top of the app's page cPanel shows a command like
   `source /home/USER/virtualenv/pcvault-api/3.10/bin/activate && cd /home/USER/pcvault-api`.
   Open cPanel → **Terminal** (or SSH), paste it, then:

   ```bash
   pip install -r requirements.txt
   ```

   (Alternatively type `requirements.txt` into the app page's
   *Configuration files* field and click **Run Pip Install**.)

> **URL prefix note:** Passenger strips the mount point before requests reach
> the app, and FastAPI's own routes already start with `/api/v1/...`. So:
> - mounted at URL path `/api` → public API base is
>   `https://yourdomain.com/api` and endpoints resolve at
>   `https://yourdomain.com/api/api/v1/...` — set
>   `NEXT_PUBLIC_API_URL=https://yourdomain.com/api`.
> - mounted on `api.yourdomain.com` → endpoints are
>   `https://api.yourdomain.com/api/v1/...` — set
>   `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`. (Cleaner; recommended.)

## 3. Environment variables

In **Setup Python App** → your app → **Environment variables** → *Add variable*
(one per row):

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql+pymysql://USER_pcvault:DB_PASSWORD@localhost:3306/USER_pcvault` |
| `FERNET_KEY` | output of the keygen command below — never the example key |
| `ADMIN_PASSWORD` | a strong login password — **required in production**; leaving it unset leaves the whole API open to the internet |
| `FRONTEND_URL` | `https://yourdomain.com` |
| `CORS_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |
| `SMTP_HOST` | `mail.yourdomain.com` (cPanel → Email Accounts → Connect Devices) |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `alerts@yourdomain.com` |
| `SMTP_PASSWORD` | that mailbox's password |
| `SMTP_FROM` | `alerts@yourdomain.com` |
| `ALERT_EMAIL_TO` | wherever warranty alerts should go |
| `WARRANTY_ALERT_DAYS` | `30` |

Generate the Fernet key (Terminal, inside the virtualenv):

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Also create `/home/USER/pcvault-api/.env` with the **same values** — the cron
script (section 7) runs outside Passenger and reads config from `.env`:

```bash
cd /home/USER/pcvault-api
cp .env.example .env
nano .env        # paste the same values as above
chmod 600 .env
```

Click **Save** on the app page, then **Restart** the application.

## 4. Run migrations + seed

cPanel → **Terminal** (or SSH):

```bash
source /home/USER/virtualenv/pcvault-api/3.10/bin/activate
cd /home/USER/pcvault-api
alembic upgrade head          # creates all tables in MySQL
python scripts/seed.py        # optional: demo PCs and parts
```

Verify the API is live:

```bash
curl https://api.yourdomain.com/api/v1/health
# {"status":"ok","service":"pc-vault"}
curl https://api.yourdomain.com/api/v1/stats
```

If you get a Passenger error page instead, check
`/home/USER/pcvault-api/stderr.log` (see section 8).

## 5. Build the frontend locally and upload

On your **local machine**:

```bash
cd frontend
npm install
# bake the production API base URL into the bundle:
# (create .env.production or export the variable — must match section 2's note)
echo NEXT_PUBLIC_API_URL=https://api.yourdomain.com > .env.production
npm run build                  # emits frontend/out/
```

Upload:

1. Zip the **contents** of `out/` (not the folder itself).
2. cPanel → File Manager → `public_html` → delete previous site files →
   Upload the zip → Extract.
3. Confirm `public_html/index.html`, `public_html/_next/`, and
   `public_html/.htaccess` all exist (enable *Show Hidden Files* in
   File Manager settings — the `.htaccess` ships inside `out/` because it
   lives in `frontend/public/`).

Or use FTP/SFTP and copy `out/*` → `public_html/`.

## 6. .htaccess (SPA fallback)

Already handled: `frontend/public/.htaccess` is copied into `out/` on every
build and does three things —

1. leaves `/api` requests alone (when the backend is mounted on the same domain),
2. serves the exported files directly (every page exports its own
   `route/index.html` thanks to `trailingSlash: true`, so refreshes work),
3. rewrites extension-less deep links to the matching `index.html` and sends
   real unknowns to `404.html`, plus long-cache headers for hashed assets.

If you ever need to recreate it manually, copy that file into `public_html`.

## 7. Cron job for warranty alerts

cPanel → **Cron Jobs** → *Add New Cron Job*:

- **Minute** `0`, **Hour** `8`, Day/Month/Weekday `*` (daily at 08:00 server time)
- **Command**:

```bash
/home/USER/virtualenv/pcvault-api/3.10/bin/python /home/USER/pcvault-api/scripts/send_warranty_alerts.py >> /home/USER/pcvault-cron.log 2>&1
```

Note it uses the **virtualenv's** Python binary directly — no activation
needed. Test it immediately from the Terminal:

```bash
/home/USER/virtualenv/pcvault-api/3.10/bin/python /home/USER/pcvault-api/scripts/send_warranty_alerts.py --dry-run
```

`--dry-run` prints the email without sending. Remove the flag to send a real
one through cPanel SMTP.

## 8. Restarting & troubleshooting

**Restart after any backend change** (code upload, env var edit):

```bash
touch /home/USER/pcvault-api/tmp/restart.txt
```

(`mkdir -p /home/USER/pcvault-api/tmp` once if it doesn't exist), or click
**Restart** in Setup Python App.

Common issues:

| Symptom | Fix |
|---|---|
| Passenger "Something went wrong" page | Read `/home/USER/pcvault-api/stderr.log`; usually a missing package (`pip install -r requirements.txt` inside the venv) or a bad `DATABASE_URL`. |
| API works in browser, frontend shows "Signal lost" | CORS: `CORS_ORIGINS` must contain the exact frontend origin (scheme + host, no trailing slash). Restart the app after editing. |
| `Access denied for user` | Re-check DB user password and that the user is added to the database with ALL PRIVILEGES. |
| Frontend 404 on refresh of `/pcs/view?id=…` | `.htaccess` missing from `public_html` (hidden files not extracted). |
| QR scanner: camera never opens | Site must be HTTPS — enable AutoSSL under cPanel → SSL/TLS Status. |
| Warranty emails never arrive | Run the cron command manually with `--dry-run`; check `SMTP_*` values and `/home/USER/pcvault-cron.log`. Port 465 = SSL, 587 = STARTTLS (script auto-selects). |
| Changed `NEXT_PUBLIC_API_URL` | It's baked at build time — rebuild locally and re-upload `out/`. |

**Updating later:** backend → upload changed files, `alembic upgrade head` if
migrations changed, `touch tmp/restart.txt`. Frontend → `npm run build`,
re-upload `out/`.
