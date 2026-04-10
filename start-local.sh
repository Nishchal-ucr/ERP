#!/usr/bin/env bash
# Legacy entry point: same as start-local-flask.sh (Flask API + Next.js PWA).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${ROOT_DIR}/start-local-flask.sh"
