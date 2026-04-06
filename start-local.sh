#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="${ROOT_DIR}/Muqeeth-farm-reporting-api-7b913426eb4e"
PWA_DIR="${ROOT_DIR}/Muqeeth-farm-reporting-pwa-518759402314"

if [[ ! -d "${API_DIR}" || ! -d "${PWA_DIR}" ]]; then
  echo "Expected app folders not found under ${ROOT_DIR}"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Please install Node.js (v20+ recommended)."
  exit 1
fi

install_if_needed() {
  local dir="$1"
  local label="$2"
  if [[ ! -d "${dir}/node_modules" ]]; then
    echo "[${label}] Installing dependencies..."
    (cd "${dir}" && npm install)
  fi
}

ensure_api_cli() {
  if [[ ! -x "${API_DIR}/node_modules/.bin/nest" ]]; then
    echo "[API] Nest CLI not found in local deps, reinstalling dependencies..."
    (cd "${API_DIR}" && npm install)
  fi
}

ensure_frontend_env() {
  local env_file="${PWA_DIR}/.env.local"
  if [[ ! -f "${env_file}" ]]; then
    echo "[WEB] Creating .env.local with local API base URL..."
    cat > "${env_file}" <<'EOF'
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
EOF
  fi
}

shutdown() {
  echo
  echo "Stopping local services..."
  [[ -n "${API_PID:-}" ]] && kill "${API_PID}" 2>/dev/null || true
  [[ -n "${PWA_PID:-}" ]] && kill "${PWA_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
}

trap shutdown EXIT INT TERM

install_if_needed "${API_DIR}" "API"
install_if_needed "${PWA_DIR}" "WEB"
ensure_api_cli
ensure_frontend_env

echo "[API] Starting Nest API..."
(cd "${API_DIR}" && npm run start:dev) &
API_PID=$!

echo "[WEB] Starting Next.js app..."
(cd "${PWA_DIR}" && npm run dev) &
PWA_PID=$!

echo
echo "Apps starting..."
echo "- Web: http://localhost:3000"
echo "- API: check terminal output for exact port (commonly 3001)"
echo "Press Ctrl+C to stop both."
echo

wait
