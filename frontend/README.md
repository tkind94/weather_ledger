# Weather Ledger Frontend

This SvelteKit app runs on Bun with the Node adapter so it can query the shared DuckDB file directly from server load functions.

## Commands

```sh
bun run dev
bun run check
bun run test
bun run build
bun run preview
```

## Database contract

The server reads from `../database/weather.duckdb` and expects a `raw_weather` table populated by the Python pipeline.
Set `WEATHER_LEDGER_DB_PATH` if you want to run the built server from a different working directory.

## Start Here

If you are trying to understand the app, read these files first:

- `src/routes/+page.server.ts`
- `src/lib/server/weather.ts`
- `src/routes/+page.svelte`
- `src/lib/components/WeatherHistoryChart.svelte`
