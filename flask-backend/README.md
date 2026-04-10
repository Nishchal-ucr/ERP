# Flask backend

REST API for farm daily reporting (PostgreSQL, JWT auth, PDF reports, CSV init).

## Prerequisites

- Python 3.10+
- PostgreSQL with a database and user (see repo root [README.md](../README.md))

## Setup

```bash
cd flask-backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, etc.
```

## Run (development)

```bash
python app.py
```

- Binds to `0.0.0.0` on port from `PORT` (default **8001**).
- On startup: `initialize_schema()` and `seed_data()` (idempotent where applicable).

Default URL: `http://localhost:8001`

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL URL, e.g. `postgresql://user:pass@127.0.0.1:5432/erp_db` |
| `PORT` | Listen port (default `8001`) |
| `JWT_SECRET` | Secret for signing tokens |
| `JWT_EXP_HOURS` | Token lifetime (default `24`) |
| `SEED_SMTP_*` | Optional; used when seeding SMTP settings into the DB |

See `.env.example`.

## Routes (overview)

- `GET /`
- `POST /api/user/login`
- `GET /api/sheds`, `GET /api/sheds/<id>`
- `GET /api/parties`, `GET /api/parties?role=buyer|seller`, `GET /api/parties/<id>`
- `GET /api/feed-items`, `GET /api/feed-items/<id>`
- `POST /api/daily-reports/submit`
- `PUT /api/daily-reports/update`
- `GET /api/daily-reports`
- `GET /api/daily-reports/<id>`
- `GET /api/daily-reports/by-date/<YYYY-MM-DD>`

## CSV initialization

```bash
python init_from_csv.py --help
```

Typical first import (after editing `.env` and placing CSVs under `csvs/`):

```bash
python init_from_csv.py --skip-seed
```

## Production

Use a WSGI server (e.g. Gunicorn) behind a reverse proxy; do not rely on Flask’s `debug` server in production.
