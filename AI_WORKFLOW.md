# Weather Ledger AI Workflow

This file is primarily for AI assistants and repository automation. If you are onboarding as a human developer, start with `README.md` and `DEVELOPMENT.md` first.

## Validation loop

Run changes in this order so each layer is verified against the real shared DuckDB file:

```sh
cd data-pipeline && uv run python fetch.py
cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build
cd frontend && bun run check
cd frontend && bun run test:unit -- --run
cd frontend && bun run build
docker compose config
```

## Documentation sources

Reference Context7 before wiring unfamiliar libraries or deployment details.

- SvelteKit Node adapter and server `load` docs: used to move the app off the Cloudflare worker target and onto a Bun-run Node server.
- DuckDB Node client docs: used for `Database(..., { access_mode: 'READ_ONLY' })` and server-side query patterns.
- `dbt-duckdb` docs: used for the checked-in `profiles.yml` targeting the shared DuckDB file.

## Working rules for this repo

- Node and TypeScript package management stays on Bun.
- Python environment and commands stay on uv.
- The single shared database file is `database/weather.duckdb`.
- Use `WEATHER_LEDGER_DB_PATH` when the frontend server is launched from outside the `frontend` directory.
- Validate ingestion before frontend work when schema changes land.
- Keep server-only DuckDB access inside `frontend/src/lib/server` and `+page.server.ts` routes.

## AI setup note

No repo-local AI skill installation is required to work on Weather Ledger.

If an agent needs extra documentation, it should fetch that documentation at runtime instead of assuming local skills are part of project setup.
