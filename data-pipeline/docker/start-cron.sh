#!/bin/sh
set -eu

cd /app/data-pipeline

./docker/run-fetch.sh

DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-/app/data-pipeline/.dbt}" uv run dbt seed --select test_weather_seed climatology_baseline
DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-/app/data-pipeline/.dbt}" uv run dbt build --select marts.weather_stats --full-refresh

touch /tmp/weather-bootstrap-complete
cron -f
