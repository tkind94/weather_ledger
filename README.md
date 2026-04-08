# Weather Ledger

Weather Ledger is a local-first weather history app built with Next.js, React, SQLite, and Open-Meteo. The app caches searched locations and their daily observations directly from server route handlers, so there is no separate Python fetch job, dbt project, or DuckDB snapshot to maintain.

## Project Layout

- `frontend/`: Next.js App Router app on Bun.
- `database/`: Local SQLite cache created on demand.

## Prerequisites

- Bun
- Docker Desktop or compatible Docker Engine for containerized review

## Quick Start

Install dependencies and start the app:

```sh
cd frontend && bun install
cd frontend && bun run dev
```

Open `http://localhost:3000`.

On the first request, the app seeds SQLite with the default location. After that, every search and refresh writes directly into `database/weather.sqlite3`.

## Validation

The core local validation path is:

```sh
just validate
```

That runs frontend lint, typecheck, unit tests, build, and `docker compose config`.

## Docker

Run the app in Docker with:

```sh
docker compose up --build
```

Open `http://localhost:3000`.

`cloudflared` stays optional and only starts with `--profile tunnel`.

## Environment Variables

- `WEATHER_LEDGER_SQLITE_PATH`: override the SQLite database path.
- `WEATHER_LEDGER_HISTORY_START`: earliest date fetched for a new location. Defaults to `2020-01-01`.
- `WEATHER_LEDGER_DEFAULT_LOCATION_*`: override the seeded default location.
- `CLOUDFLARE_TUNNEL_TOKEN`: enable the optional tunnel container.

## Important Files

- `frontend/src/app/page.tsx`
- `frontend/src/app/api/locations/route.ts`
- `frontend/src/app/api/locations/search/route.ts`
- `frontend/src/lib/server/weather.ts`
- `frontend/src/lib/server/open-meteo.ts`
- `frontend/src/lib/server/sqlite.ts`

## Generated Files

- `database/weather.sqlite3` is generated local state and should not be committed.
- `frontend/.next/` and `frontend/build/` are generated frontend output and should not be committed.

Use this to clear generated output:

```sh
just clean
```
