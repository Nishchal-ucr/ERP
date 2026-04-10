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

Open [http://localhost:3000](http://localhost:3000).

From the **repository root**, you can start API + PWA together with `./start-local-flask.sh`.

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
| `npm run dev` | Development server (webpack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
