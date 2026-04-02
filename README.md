# Weather Ledger

Weather Ledger is a local-first weather history app for cached and on-demand locations. It ingests daily observations from Open-Meteo into a shared DuckDB file, transforms them with dbt, and serves a SvelteKit dashboard with local search plus click-to-add map selection.

## Project Layout

- `data-pipeline/`: Python ingestion script, dbt project, and cron container.
- `frontend/`: SvelteKit app running on Bun with a server-side DuckDB query path.
- `database/`: Shared `weather.duckdb` file used by Python, dbt, and the frontend.

## Prerequisites

- Bun
- Python 3.12+
- `uv`
- Docker Desktop or compatible Docker Engine for containerized review

## Quick Start

Install local dependencies:

```sh
./scripts/setup-local.sh
```

If you want to clear generated output first:

```sh
./scripts/clean.sh
```

Populate the database and build the first dbt models:

```sh
cd data-pipeline && uv run python fetch.py
cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build --select weather_daily_history location_catalog weather_monthly_extremes dashboard_summary
```

Run the frontend locally:

```sh
cd frontend && bun run dev
```

Open `http://localhost:5173`.

## Fast Review Paths

If you want to review the repo quickly, use one of these:

### Local runtime

```sh
./scripts/validate.sh
cd frontend && bun run dev
```

### Docker runtime

```sh
docker compose up --build
```

Open `http://localhost:3000`.

## How You Can Validate As A User

The most useful validation sequence is:

1. `./scripts/setup-local.sh`
2. `./scripts/validate.sh`
3. `docker compose up --build`
4. Visit `http://localhost:3000`

What success looks like:

- `data-pipeline/fetch.py` creates or updates `database/weather.duckdb`
- dbt builds `weather_daily_history`, `location_catalog`, `weather_monthly_extremes`, and `dashboard_summary`
- SvelteKit typecheck and tests pass
- the page shows a cached location search, a click-to-add map, weather observations, metrics, and the daily observations table

## Generated Files

Generated artifacts are intentionally ignored at the repo root.

- `database/weather.duckdb` is local generated state and should not be committed.
- dbt output lives under `data-pipeline/target/` and `data-pipeline/logs/`.
- frontend build output lives under `frontend/build/` and `frontend/.svelte-kit/`.

Use this to clear them:

```sh
./scripts/clean.sh
```

## Docker Notes

- `docker compose up --build` starts the fetcher and frontend.
- `cloudflared` is intentionally disabled by default and only starts with `--profile tunnel`.
- To use the tunnel later, copy `.env.example` to `.env` and set `CLOUDFLARE_TUNNEL_TOKEN`.

## Important Files

- `data-pipeline/fetch.py`: location-aware Open-Meteo ingestion into DuckDB
- `data-pipeline/.dbt/profiles.yml`: local dbt profile for the shared database
- `frontend/src/lib/server/weather.ts`: server-only DuckDB query helper
- `frontend/src/lib/server/location-pipeline.ts`: on-demand fetch + dbt orchestration from the app server
- `frontend/src/routes/+page.server.ts`: page load function
- `frontend/src/routes/+page.svelte`: weather dashboard

## CI

`.github/workflows/ci.yml` runs the same core checks as `./scripts/validate.sh`.
