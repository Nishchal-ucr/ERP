#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLASK_DIR="${ROOT_DIR}/flask-backend"
PWA_DIR="${ROOT_DIR}/PMR-farm-reporting-pwa"
VENV_DIR="${FLASK_DIR}/.venv"

if [[ ! -d "${FLASK_DIR}" || ! -d "${PWA_DIR}" ]]; then
  echo "Expected folders not found under ${ROOT_DIR}"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found."
  exit 1
fi

shutdown() {
  echo
  echo "Stopping local services..."
  [[ -n "${FLASK_PID:-}" ]] && kill "${FLASK_PID}" 2>/dev/null || true
  [[ -n "${PWA_PID:-}" ]] && kill "${PWA_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
}

trap shutdown EXIT INT TERM

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "[FLASK] Creating virtual environment..."
  python3 -m venv "${VENV_DIR}"
fi

echo "[FLASK] Upgrading pip (helps install wheels for new packages)..."
"${VENV_DIR}/bin/python" -m pip install --upgrade pip --quiet

echo "[FLASK] Installing/updating Python dependencies from requirements.txt..."
"${VENV_DIR}/bin/pip" install -r "${FLASK_DIR}/requirements.txt"

echo "[WEB] Ensuring npm dependencies (safe to re-run if already up to date)..."
(cd "${PWA_DIR}" && npm install)

echo "[FLASK] Starting Flask API on 8001..."
(cd "${FLASK_DIR}" && "${VENV_DIR}/bin/python" app.py) &
FLASK_PID=$!

echo "[WEB] Starting Next.js app on 3000..."
(cd "${PWA_DIR}" && npm run dev) &
PWA_PID=$!

echo
echo "Apps starting..."
echo "- Flask API: http://localhost:8001"
echo "- Frontend:  http://localhost:3000"
echo "Press Ctrl+C to stop both."
echo

wait
