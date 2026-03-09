#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

cd "$repo_root/data-pipeline"
uv run python fetch.py
DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build

cd "$repo_root/frontend"
bun run check
bun run test:unit -- --run
bun run build

cd "$repo_root"
docker compose config >/dev/null

printf '\nValidation complete.\n'