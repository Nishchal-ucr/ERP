# PMR Farms – Reporting PWA

Next.js PWA for daily farm reporting. Talks to the Flask API via `NEXT_PUBLIC_API_BASE_URL`.

## Prerequisites

- Node.js 20+
- Running Flask backend (see repo root [README.md](../README.md))

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit **`.env.local`** and set:

- `NEXT_PUBLIC_API_BASE_URL` – Flask base URL, e.g. `http://localhost:8001` (no trailing slash)

## Run (development)

```bash
npm run dev
```

Always run **`npm run dev`** (or `npx next dev --webpack`) from **this directory** after `npm install`. The `next` binary is not on your global PATH; running `next` from the repository root will fail with “command not found”.

Open [http://localhost:3000](http://localhost:3000).

From the **repository root**, you can start API + PWA together with `./start-local-flask.sh` (PWA on localhost only). For **phone / LAN** testing, run the Flask API as usual and start the PWA with **`npm run dev:lan`** so the dev server listens on `0.0.0.0`, then open `http://<your-computer-LAN-ip>:3000` on the phone.

### Phone on the same Wi‑Fi

| Topic | What to do |
|--------|------------|
| Dev server | `npm run dev:lan` (not `dev`) so other devices can reach port 3000. |
| API from the phone | Set `NEXT_PUBLIC_API_BASE_URL` to `http://<LAN-ip>:8001`, not `http://localhost:8001`. |
| Firewall | Allow TCP **3000** and **8001** on the dev machine if connections fail. |
| Stale UI / errors | Clear site data for that origin once; Serwist is off in `next dev` to avoid stale service worker caches. |

### Internet access (HTTPS tunnel)

To share the app with people not on your LAN while it runs on your machine, use **two tunnels** (PWA port 3000, API port 8001) and set `NEXT_PUBLIC_API_BASE_URL` to the **API tunnel’s HTTPS origin**. See **“Public demo via HTTPS tunnel”** in the repo root [README.md](../README.md).

## Build (production-style)

```bash
npm run build
npm run start
```

## Report date picker (local vs production)

- In **`next dev`**, the report date field is **relaxed** (any date) unless you set `NEXT_PUBLIC_FORCE_STRICT_REPORT_DATES=true` in `.env.local`.
- Production builds use **strict** bounds (latest submitted report through today) unless you set `NEXT_PUBLIC_RELAX_REPORT_DATE_BOUNDS=true`.

See `.env.example` for those flags.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (webpack), localhost |
| `npm run dev:lan` | Dev server bound to `0.0.0.0` (phones on same Wi‑Fi) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
