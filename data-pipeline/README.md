# Data Pipeline

This directory owns ingestion and transformation.

- `fetch.py` pulls weather history from Open-Meteo into the shared DuckDB file.
- dbt models build typed staging and first-pass mart tables above `raw_weather`.
- the Docker image here also runs the scheduled cron fetcher.

## Ingestion

Run the historical fetch manually:

```sh
uv run python fetch.py
```

The script writes into `../database/weather.duckdb`, creating `raw_weather` when needed and refreshing the latest 7 complete days of Fort Collins observations.

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
cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build
```

The default profile path targets `../database/weather.duckdb`. Override it with `DBT_DUCKDB_PATH` if you need a different location.
