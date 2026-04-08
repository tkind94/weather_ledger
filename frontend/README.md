# Weather Ledger Frontend

This frontend is a Next.js App Router application on Bun. It talks directly to Open-Meteo from server route handlers, persists cached locations plus daily observations in a local SQLite file, and renders the dashboard with React server components.

## Commands

```sh
bun install
bun run dev
bun run check
bun run lint
bun run test:unit
bun run build
bun run start
```

## Runtime contract

- SQLite lives at `../database/weather.sqlite3` by default.
- Override the database path with `WEATHER_LEDGER_SQLITE_PATH`.
- The first request seeds the database with the default location if the cache is empty.

## Key files

- `src/app/page.tsx`
- `src/app/api/locations/route.ts`
- `src/app/api/locations/search/route.ts`
- `src/lib/server/weather.ts`
- `src/lib/server/open-meteo.ts`
- `src/lib/server/sqlite.ts`
