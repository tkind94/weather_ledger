# Development Guide

This file is for humans working in the repo. It consolidates the commands and conventions needed to iterate safely.

## Daily Validation Loop

Run this before asking someone else to review your branch:

```sh
just validate
```

Equivalent manual commands:

```sh
cd frontend && bun run lint
cd frontend && bun run check
cd frontend && bun run test:unit
cd frontend && bun run build
cd .. && docker compose config
```

## Local Setup

Install everything needed for local development:

```sh
just setup
```

That installs frontend dependencies with Bun and refreshes local hooks via `prek`.

## Cleanup generated output

Use this when you want a clean local worktree without generated artifacts:

```sh
just clean
```

That removes the generated SQLite file plus the frontend build output.

## Conventions

- Use Bun for all Node and TypeScript dependencies and scripts.
- Keep Open-Meteo calls inside Next.js route handlers or server helpers.
- Keep SQLite access in server-only modules under `frontend/src/lib/server/`.
- Use client components only for search, navigation, or other browser interactions.
- Keep the dashboard page itself server-rendered.

## Environment Variables

- `WEATHER_LEDGER_SQLITE_PATH`: overrides the SQLite file path.
- `WEATHER_LEDGER_HISTORY_START`: earliest date fetched for a new location.
- `WEATHER_LEDGER_DEFAULT_LOCATION_*`: overrides the default seeded location.
- `CLOUDFLARE_TUNNEL_TOKEN`: enables the optional tunnel container.

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

- `frontend/src/app/page.tsx`
- `frontend/src/app/api/locations/route.ts`
- `frontend/src/app/api/locations/search/route.ts`
- `frontend/src/lib/server/weather.ts`
- `frontend/src/lib/server/open-meteo.ts`
- `frontend/src/lib/server/sqlite.ts`

## CI

GitHub Actions runs the same core validation path in `.github/workflows/ci.yml`.
