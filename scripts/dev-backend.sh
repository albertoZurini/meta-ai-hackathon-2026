#!/usr/bin/env bash
# Start the FastAPI backend on :8000 (Vite on :3000 proxies /api here).
set -euo pipefail
cd "$(dirname "$0")/../server"
exec uv run uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}" --reload
