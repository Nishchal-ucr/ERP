# Flask Backend

Flask replacement backend for parity with the NestJS API.

## Setup

```bash
cd "/Users/nishchalparne/Documents/ERP/flask-backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Default URL: `http://localhost:8001`

## Routes

- `GET /`
- `POST /api/user/login`
- `GET /api/sheds`, `GET /api/sheds/<id>`
- `GET /api/parties`, `GET /api/parties/<id>`
- `GET /api/feed-items`, `GET /api/feed-items/<id>`
- `POST /api/daily-reports/submit`
- `PUT /api/daily-reports/update`
- `GET /api/daily-reports`
- `GET /api/daily-reports/<id>`
- `GET /api/daily-reports/by-date/<date>`
