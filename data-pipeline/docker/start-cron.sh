#!/bin/sh
set -eu

cd /app/data-pipeline

./docker/run-fetch.sh

DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-/app/data-pipeline/.dbt}" uv run dbt build

touch /tmp/weather-bootstrap-complete
cron -f
