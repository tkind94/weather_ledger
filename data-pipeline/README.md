# Data Pipeline

This directory owns ingestion and transformation.

- `fetch.py` resolves a canonical location, fetches any missing daily weather history, and stores it in the shared DuckDB file.
- dbt models build the location-aware marts the frontend reads.
- the Docker image here also runs the scheduled cron fetcher.

## Ingestion

Run the historical fetch manually:

```sh
uv run python fetch.py
```

The script writes into `../database/weather.duckdb`, creating `raw_locations` and `raw_weather` when needed. It uses a stable `location_key`, keeps a reusable local cache, and fetches only missing days for each location.

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

The default profile path targets `../database/weather.duckdb`. Override it with `DBT_DUCKDB_PATH` if you need a different location. The frontend’s on-demand location path uses the same database file and runs this dbt build after each new location fetch.
