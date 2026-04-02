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

## Architecture rules

### Data flow

```
Open-Meteo API → fetch.py → raw_weather (DuckDB)
                                ↓
              weather_monthly_extremes   dashboard_summary (dbt tables)
                                              ↓
                                    SvelteKit server load → page
```

- `fetch.py` **upserts** (INSERT OR REPLACE). It never drops or recreates tables.
  History accumulates across runs — this is a ledger.
- `fetch.py` owns the schema (`CREATE TABLE IF NOT EXISTS`). Types are enforced at
  the boundary — no staging view needed.
- All aggregation and transformation happens in **dbt models**, not in the frontend.
  The Svelte page is purely presentational — no `.reduce()`, no client-side computation.
- The frontend opens **one DuckDB connection per request** and runs both queries against it.

### What goes where

| Concern | Where | NOT here |
|---------|-------|----------|
| Aggregation (sum, avg, max) | dbt model | Svelte `$derived`, JS `.reduce()` |
| Type casting | `fetch.py` (`CREATE TABLE`) | Column types enforced at ingestion |
| Display formatting (`.toFixed`) | Svelte template | dbt SQL |
| camelCase aliasing | frontend SQL query | dbt model column names |

### Frontend types

- Types in `$lib/weather.ts` must match what the SQL query returns — no extra fields.
- All types use **camelCase**. The SQL query aliases handle `snake_case` → `camelCase`.
- Query only the columns the UI renders. Do not `SELECT *`.

## Project structure

```
data-pipeline/   Python ingestion + dbt transformation
frontend/        SvelteKit app (Bun + TypeScript)
database/        Shared weather.duckdb (gitignored)
docker-compose.yml
```

Key files most likely to need editing:
- `data-pipeline/fetch.py`
- `data-pipeline/models/marts/`
- `frontend/src/lib/server/weather.ts`
- `frontend/src/routes/+page.server.ts`
- `frontend/src/routes/+page.svelte`
