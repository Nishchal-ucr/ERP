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

### Troubleshooting: `next` command not found

Next.js is installed **only** under `PMR-farm-reporting-pwa/node_modules`, not globally. To avoid “next missing” errors:

- Run the PWA from that folder: `cd PMR-farm-reporting-pwa && npm install`
- Start dev with **`npm run dev`** (not a bare `next` from the repo root).
- If you need the CLI by name: `cd PMR-farm-reporting-pwa && npx next dev` (or `npx next dev --webpack` to match `package.json`).

### Testing the PWA on a phone (same Wi‑Fi / LAN)

Use the machine’s **LAN IP** (e.g. `http://192.168.x.x:3000`), not `localhost`, on the phone.

1. **Bind the dev server to all interfaces** so the phone can connect:

   ```bash
   cd PMR-farm-reporting-pwa && npm run dev:lan
   ```

   (`dev:lan` runs `next dev` with `-H 0.0.0.0`.)

2. **Firewall** – allow incoming **TCP 3000** (and **8001** for the API) for `node`/Python on the dev machine, or temporarily relax the firewall to verify connectivity.

3. **API URL on the phone** – `NEXT_PUBLIC_API_BASE_URL=http://localhost:8001` points at the **phone**, not your computer. For LAN testing, set it to your computer’s IP, e.g. `http://192.168.x.x:8001`, in `PMR-farm-reporting-pwa/.env.local` (rebuild/restart dev after changing).

4. **Stale overlay / “Load failed”** – if you still see an old Next version or chunk errors, clear **site data** for that origin on the phone (or use a fresh private tab). Serwist is **disabled in `next dev`** so a service worker should not interfere during normal local development.

### Public demo via HTTPS tunnel (internet while running locally)

Use this when people **outside your Wi‑Fi** need to reach the app while it still runs on your machine. You need **two HTTPS tunnels** (one for the PWA, one for the API) unless you add a reverse proxy yourself.

1. **Start the stack** (Flask + Next on `localhost`):

   ```bash
   ./start-local-flask.sh
   ```

   Or run Flask and `npm run dev` in `PMR-farm-reporting-pwa` in separate terminals.

2. **Create two tunnels** to `127.0.0.1` (install [Cloudflare Tunnel (`cloudflared`)](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) or [ngrok](https://ngrok.com/) first):

   **Cloudflare Tunnel (quick tunnels)** – two terminals:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:3000
   ```

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8001
   ```

   **ngrok** – two terminals:

   ```bash
   ngrok http 3000
   ```

   ```bash
   ngrok http 8001
   ```

   Each command prints a public **HTTPS** URL. Treat the **3000** tunnel as the **PWA** and the **8001** tunnel as the **API**.

3. **Point the PWA at the API tunnel** – in `PMR-farm-reporting-pwa/.env.local`, set:

   ```bash
   NEXT_PUBLIC_API_BASE_URL=https://<your-api-tunnel-host>
   ```

   No trailing slash. Use the **API** tunnel’s origin only (not the PWA URL). Restart the Next dev server after saving.

4. **Share the PWA tunnel URL** – send the **HTTPS URL for port 3000** to others. Your computer must stay on and the tunnels + app processes must keep running.

**Security:** tunnel URLs are public. Flask runs with `debug=True` in development, which is **not** suitable for sensitive production data. Use tunnels for **short demos** only, or harden the backend before wider exposure. Prefer deploying the PWA and API to proper hosting for ongoing “everyone” access.

**Long-term hosting:** build the PWA (`make ci`) and deploy (e.g. Netlify; see `PMR-farm-reporting-pwa/netlify.toml`), deploy Flask with Postgres on a host, and set `NEXT_PUBLIC_API_BASE_URL` to your production API URL.

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
