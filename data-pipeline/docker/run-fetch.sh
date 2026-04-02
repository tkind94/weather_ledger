#!/bin/sh
set -eu

cd /app/data-pipeline
uv run python fetch.py
DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-/app/data-pipeline/.dbt}" uv run dbt build --select weather_daily_history location_catalog weather_monthly_extremes dashboard_summary
