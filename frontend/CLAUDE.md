## Project Configuration

- **Language**: TypeScript
- **Package Manager**: `bun` — NEVER use `npm`, `npx`, `yarn`, or `pnpm`
- **Framework**: Next.js App Router with React 19
- **Storage**: local SQLite via `better-sqlite3`

## Commands

```sh
bun run dev
bun run build
bun run start
bun run check
bun run lint
bun run test:unit
```

## Runtime notes

- The app caches data in `../database/weather.sqlite3` by default.
- Override that path with `WEATHER_LEDGER_SQLITE_PATH`.
- Open-Meteo calls happen only inside `src/app/api/**` route handlers and server-side helpers.
- The dashboard should stay server-rendered for data reads; client components should handle only search and navigation interactions.

## Start here

- `src/app/page.tsx`
- `src/components/location-search-panel.tsx`
- `src/lib/server/weather.ts`
- `src/lib/server/open-meteo.ts`
- `src/lib/server/sqlite.ts`
