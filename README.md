# ERP – Farm reporting (Flask API + Next.js PWA)

Monorepo for daily farm reporting: a **Flask** backend (PostgreSQL) and a **Next.js** PWA.

## Prerequisites

- **Python 3.12+** (3.10+ should work)
- **Node.js 20+** and npm
- **PostgreSQL 14+** running locally (or remote `DATABASE_URL`)

## Quick start (recommended)

From the repository root:

1. **PostgreSQL** – create a database and user (example):

   ```sql
   CREATE ROLE erp_user WITH LOGIN PASSWORD 'your_password';
   CREATE DATABASE erp_db OWNER erp_user;
   ```

2. **Backend env** – copy and edit:

   ```bash
   cp flask-backend/.env.example flask-backend/.env
   ```

   Set `DATABASE_URL` (and optional seed SMTP vars if you want seeded email config).

3. **PWA env** – copy and edit:

   ```bash
   cp PMR-farm-reporting-pwa/.env.example PMR-farm-reporting-pwa/.env.local
   ```

   Point `NEXT_PUBLIC_API_BASE_URL` at the Flask server (default `http://localhost:8001`).

4. **Run API + PWA together** (from repo root):

   ```bash
   chmod +x start-local-flask.sh   # once, if needed
   ./start-local-flask.sh
   ```

   Or: `make dev` (same script).

   - API: [http://localhost:8001](http://localhost:8001)
   - PWA: [http://localhost:3000](http://localhost:3000)

   The script creates `flask-backend/.venv`, installs Python deps, runs `npm install` in the PWA, then starts both processes. Stop with `Ctrl+C`.

## First-time database

On a fresh Postgres database, starting `flask-backend` with `python app.py` runs **schema initialization** and **seed** (users, sheds, sample data). Alternatively run once (with `.env` / `DATABASE_URL` set):

```bash
cd flask-backend
source .venv/bin/activate
python -c "from db.schema import initialize_schema; from db.seed import seed_data; initialize_schema(); seed_data()"
```

(Or simply start the app via `python app.py` once.)

## CSV initialization (optional)

See `flask-backend/README.md` and `flask-backend/init_from_csv.py` for importing production standards, parties, feed data, etc.

## Pre-production check (PWA build)

From the repo root:

```bash
make ci
```

This runs `npm run build` in `PMR-farm-reporting-pwa/` (production compile gate). Run `cd PMR-farm-reporting-pwa && npm run lint` separately to track ESLint issues.

## Project layout

| Path | Description |
|------|-------------|
| `flask-backend/` | Flask API, SQL schema, seeds, CSV init, PDF reports |
| `PMR-farm-reporting-pwa/` | Next.js PWA |
| `start-local-flask.sh` | Local dev: venv + both servers |

## Documentation

- [flask-backend/README.md](flask-backend/README.md) – API routes and backend-only setup
- [PMR-farm-reporting-pwa/README.md](PMR-farm-reporting-pwa/README.md) – PWA-only setup
