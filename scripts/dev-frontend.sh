#!/usr/bin/env bash
# Start the Vite frontend on :3000.
set -euo pipefail
cd "$(dirname "$0")/../web"
[ -d node_modules ] || pnpm install
exec pnpm dev
