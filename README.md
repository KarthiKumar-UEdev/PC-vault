# PC Vault

Futuristic PC inventory command center: track machines, parts, transfers,
warranties and network info — with an interactive 3D viewer and QR labels.

- **Frontend** — Next.js 15 (App Router, TypeScript strict, static export),
  Tailwind CSS, Framer Motion, React Three Fiber, Zustand, TanStack Query
- **Backend** — FastAPI + synchronous SQLAlchemy 2.0, Pydantic v2, Alembic
- **Database** — MySQL 8 / MariaDB in production, SQLite fallback for dev
- **Deployment** — MilesWeb shared cPanel (static files + Passenger Python app),
  see [DEPLOY.md](DEPLOY.md)

```
pc-vault/
├── frontend/              # Next.js 15 static export (out/ → public_html)
├── backend/
│   ├── app/               # FastAPI application
│   ├── alembic/           # migrations
│   ├── scripts/           # seed.py, send_warranty_alerts.py (cron)
│   └── passenger_wsgi.py  # cPanel Passenger entrypoint (a2wsgi bridge)
├── DEPLOY.md              # step-by-step cPanel deployment guide
└── README.md
```

## Local development (no Docker)

### Prerequisites

- Python 3.10+ (3.12 tested)
- Node.js 20+ (22 tested)
- Optional: local MySQL 8 — SQLite is the zero-setup default

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # defaults to SQLite — no edits needed for dev
# For MySQL instead, set in .env:
#   DATABASE_URL=mysql+pymysql://root:password@localhost:3306/pcvault
# Generate a real encryption key (required before storing network info you care about):
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

alembic upgrade head          # create schema
python scripts/seed.py        # 3 sample PCs (Skyven, Elite18, Workstation-173) + 17 parts
uvicorn app.main:app --reload --port 8000
```

Verify: <http://localhost:8000/api/v1/health> → `{"status":"ok"}`,
interactive docs at <http://localhost:8000/api/v1/docs>.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000 (default)
npm run dev
```

Open <http://localhost:3000>.

### 3. Warranty alert cron script (manual test)

```bash
cd backend
python scripts/send_warranty_alerts.py --dry-run   # prints the email, sends nothing
```

## Production build

```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com npm run build   # emits frontend/out/
```

Everything in `out/` (including the pre-configured `.htaccess`) is uploaded to
`public_html`. Full instructions: [DEPLOY.md](DEPLOY.md).

## Notes & conventions

- **Dynamic routes** use query params (`/pcs/view?id=…`, `/parts/view?id=…`,
  `/pc/qr?t=…`) because `output: 'export'` cannot render unknown path segments.
  QR codes therefore encode `{FRONTEND_URL}/pc/qr?t={token}`.
- **Parts with `pc_id = NULL` are "in inventory."** Every move via
  `POST /parts/{id}/transfer` writes a `transfer_logs` row automatically.
- **IP/MAC addresses** are Fernet-encrypted before hitting the database and
  only decrypted in API responses. Rotating `FERNET_KEY` makes existing
  ciphertext unreadable (shows `<decryption failed>`).
- **No in-process schedulers** — Passenger kills idle workers, so warranty
  alerts run from `scripts/send_warranty_alerts.py` via cPanel cron.
- QR scanning (`/scan`) needs camera access: HTTPS in production
  (localhost is exempt during dev).
