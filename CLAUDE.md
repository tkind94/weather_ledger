# Weather Ledger — Agent Instructions

## Toolchain (strict)

| Layer | Tool | NEVER use |
|-------|------|-----------|
| Node / TypeScript | `bun` | `npm`, `npx`, `yarn`, `pnpm` |
| Python | `uv run` | `python`, `pip`, `pipenv` |
| dbt | `uv run dbt` | `dbt` directly (outside uv) |

Every command that touches the frontend must go through `bun`. Every command that touches
`data-pipeline/` must go through `uv run`. Violations will silently use the wrong lockfile
or binary and are the root cause of past "npm vs bun" config bugs.

## Test commands

```sh
# Frontend unit + component
cd frontend && bun run test:unit -- --run

# Frontend e2e (builds first, requires no process on port 4173)
cd frontend && bun run test:e2e

# Full frontend check
cd frontend && bun run check

# Data pipeline
cd data-pipeline && uv run python fetch.py
cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build
```

## E2E test setup

Playwright e2e tests require a seeded DuckDB. `tests/e2e/global-setup.ts` creates
`/tmp/weather-ledger-test.duckdb` and sets `WEATHER_LEDGER_DB_PATH` before the preview
server starts. Do not replace this with mocks or a live production DB. The preview server
runs on port 4173 via `PORT=4173` in `playwright.config.ts`.

## Environment variables

- `WEATHER_LEDGER_DB_PATH` — overrides the DuckDB path for the frontend server
- `DBT_PROFILES_DIR` — points dbt at `data-pipeline/.dbt`
- `DBT_DUCKDB_PATH` — overrides the DuckDB path for dbt
- `PORT` — controls the adapter-node listen port (default 3000; e2e tests use 4173)

## Project structure

```
data-pipeline/   Python ingestion + dbt transformation
frontend/        SvelteKit app (Bun + TypeScript)
database/        Shared weather.duckdb (gitignored)
scripts/         validate.sh, clean.sh, setup-local.sh
docker-compose.yml
```

Key files most likely to need editing:
- `data-pipeline/fetch.py`
- `data-pipeline/models/marts/`
- `frontend/src/lib/server/weather.ts`
- `frontend/src/routes/+page.server.ts`
- `frontend/src/routes/+page.svelte`
