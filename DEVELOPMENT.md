# Development Guide

This file is for humans working in the repo. It consolidates the commands and conventions needed to iterate safely.

## Daily Validation Loop

Run this before asking someone else to review your branch:

```sh
./scripts/validate.sh
```

Equivalent manual commands:

```sh
cd data-pipeline && uv run python fetch.py
cd data-pipeline && uv run python build_snapshot.py
cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build
cd frontend && bun run check
cd frontend && bun run test:unit -- --run
cd frontend && bun run build
cd .. && docker compose config
```

## Local Setup

Install everything needed for local development:

```sh
./scripts/setup-local.sh
```

This does three things:

- syncs the Python environment with `uv`
- installs frontend dependencies with Bun
- installs Playwright Chromium for browser-backed tests

## Cleanup generated output

Use this when you want a clean local worktree without generated artifacts:

```sh
./scripts/clean.sh
```

That removes the generated DuckDB file, dbt target output, dbt logs, and frontend build output.

## Conventions

- Use Bun for Node and TypeScript dependencies and scripts.
- Use `uv` for Python dependency management and execution.
- Mutable ingestion state lives in `database/weather.sqlite3`.
- The published frontend/dbt snapshot lives in `database/weather.duckdb`.
- Background map-add jobs live in `database/weather.jobs.sqlite3` by default.
- Keep DuckDB access in server-only frontend modules.
- Validate ingestion before changing frontend data contracts.

## Environment Variables

- `DBT_PROFILES_DIR`: points dbt at `data-pipeline/.dbt`
- `DBT_DUCKDB_PATH`: overrides the DuckDB file path for dbt
- `WEATHER_LEDGER_DB_PATH`: overrides the DuckDB file path for the frontend server
- `WEATHER_LEDGER_LEDGER_PATH`: overrides the SQLite ledger path for ingestion
- `WEATHER_LEDGER_JOB_DB_PATH`: overrides the SQLite queue path for background location jobs
- `CLOUDFLARE_TUNNEL_TOKEN`: enables the optional tunnel container

## Running The App

### Frontend only

```sh
cd frontend && bun run dev
```

### Full stack in Docker

```sh
docker compose up --build
```

### Optional cloudflared tunnel

```sh
docker compose --profile tunnel up --build
```

## If You Are Looking For The Important Code

Ignore generated output first. The files most people actually need are:

- `data-pipeline/fetch.py`
- `data-pipeline/models/`
- `frontend/src/routes/+page.server.ts`
- `frontend/src/routes/+page.svelte`
- `frontend/src/lib/server/weather.ts`
- `docker-compose.yml`

## CI

GitHub Actions runs the same core validation path in `.github/workflows/ci.yml`.
