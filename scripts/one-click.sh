#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd docker
require_cmd pnpm

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Please start Docker Desktop first."
  exit 1
fi

DB_USER="pulsechat"
DB_PASSWORD="0fd3b5cb976829cffa1f7336cbb48a70"
DB_NAME="pulsechat"
DB_HOST="localhost"
DB_PORT="5432"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if [ ! -f "apps/server/.env" ]; then
  if command -v node >/dev/null 2>&1; then
    JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  else
    JWT_SECRET="dev-secret"
  fi

  cat > "apps/server/.env" <<EOF
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
EOF
  echo "Created apps/server/.env"
fi

if [ ! -f "apps/client/.env.local" ]; then
  API_URL="${API_URL:-http://localhost:3001}"
  SOCKET_URL="${SOCKET_URL:-http://localhost:3001}"
  cat > "apps/client/.env.local" <<EOF
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_SOCKET_URL=${SOCKET_URL}
EOF
  echo "Created apps/client/.env.local"
fi

echo "Starting Postgres..."
docker compose up -d

echo "Installing dependencies..."
pnpm install

echo "Running Prisma generate + migrate..."
pnpm --filter server prisma:generate
pnpm --filter server prisma:migrate

echo "Building client..."
pnpm --filter client build

echo "Starting server and client..."
pnpm --filter server dev &
SERVER_PID=$!
pnpm --filter client start &
CLIENT_PID=$!

trap 'echo "Stopping services..."; kill "${SERVER_PID}" "${CLIENT_PID}"' SIGINT SIGTERM
wait
