#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não foi encontrado. Instale o Docker Engine e o plugin Docker Compose." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "O plugin Docker Compose não está disponível." >&2
  exit 1
fi

if [ ! -f .env ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js é necessário para gerar os secrets iniciais." >&2
    exit 1
  fi
  node scripts/init-env.mjs
fi

docker compose config --quiet
docker compose up --detach --build

echo "Deploy iniciado."
echo "App:           $(docker compose port app 3000)"
echo "Supabase API:  $(docker compose port api-gw 8000)"
