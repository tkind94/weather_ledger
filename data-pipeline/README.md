# Data Pipeline

This directory owns ingestion and transformation.

- `fetch.py` resolves a canonical location, fetches any missing daily weather history, and stores it in the SQLite ledger.
- `build_snapshot.py` copies the ledger raw tables into a fresh DuckDB file before dbt runs.
- dbt models build the location-aware marts the frontend reads from that DuckDB snapshot.
- the Docker image here also runs the scheduled cron fetcher.

## Ingestion

Run the historical fetch manually:

```sh
uv run python fetch.py
```

The script writes into `../database/weather.sqlite3` by default, creating `raw_locations` and `raw_weather` when needed. It uses a stable `location_key`, keeps a reusable local cache, and fetches only missing days for each location.

Publish a fresh DuckDB snapshot from the SQLite ledger:

```sh
uv run python build_snapshot.py
```

## dbt bootstrap

Exact init command:

```sh
cd data-pipeline && uv run dbt init weather_transform
```

This repository already includes the checked-in config needed for that project name:

- `dbt_project.yml`
- `.dbt/profiles.yml`

Run dbt with the local profile directory:

```sh
cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build --select weather_daily_history location_catalog weather_monthly_extremes dashboard_summary
```

The default profile path targets `../database/weather.duckdb`. Override it with `DBT_DUCKDB_PATH` if you need a different snapshot location. Override the SQLite ledger location with `WEATHER_LEDGER_LEDGER_PATH`. The frontend’s on-demand location path writes to the SQLite ledger, builds a temporary DuckDB snapshot, runs this dbt build, and atomically swaps the published snapshot.
