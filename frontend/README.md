# Weather Ledger Frontend

This SvelteKit app runs on Bun with the Node adapter so it can query the shared DuckDB file directly from server load functions and queue on-demand fetch plus dbt rebuild work for new map-selected locations.

## Commands

```sh
bun run dev
bun run check
bun run test
bun run build
bun run preview
```

## Database contract

The server reads from `../database/weather.duckdb` and expects the dbt-built `weather_daily_history`, `location_catalog`, `weather_monthly_extremes`, and `dashboard_summary` tables.
Map clicks enqueue background jobs in `../database/weather.jobs.sqlite3` by default.
Set `WEATHER_LEDGER_DB_PATH` if you want to run the built server from a different working directory.
Set `WEATHER_LEDGER_JOB_DB_PATH` if you need the background job queue stored elsewhere.

## Start Here

If you are trying to understand the app, read these files first:

- `src/routes/+page.server.ts`
- `src/lib/server/weather.ts`
- `src/lib/server/location-pipeline.ts`
- `src/routes/+page.svelte`
- `src/lib/components/LocationPickerMap.svelte`
- `src/lib/components/WeatherHistoryChart.svelte`
