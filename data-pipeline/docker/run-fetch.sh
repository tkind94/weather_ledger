#!/bin/sh
set -eu

cd /app/data-pipeline

SNAPSHOT_PATH="${WEATHER_LEDGER_DB_PATH:-/app/database/weather.duckdb}"
SNAPSHOT_DIR=$(dirname "$SNAPSHOT_PATH")
SNAPSHOT_STEM=$(basename "$SNAPSHOT_PATH" .duckdb)
SNAPSHOT_SAFE_STEM=$(printf '%s' "$SNAPSHOT_STEM" | sed 's/[^[:alnum:]_]/_/g')
TEMP_SNAPSHOT_PATH="$SNAPSHOT_DIR/${SNAPSHOT_SAFE_STEM}_tmp_$$_$(date +%s).duckdb"

uv run python fetch.py
uv run python build_snapshot.py --output-path "$TEMP_SNAPSHOT_PATH"
DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-/app/data-pipeline/.dbt}" DBT_DUCKDB_PATH="$TEMP_SNAPSHOT_PATH" uv run dbt build --select weather_daily_history location_catalog weather_monthly_extremes dashboard_summary
mv "$TEMP_SNAPSHOT_PATH" "$SNAPSHOT_PATH"
