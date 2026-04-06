#!/bin/sh
set -eu

cd /app/data-pipeline

./docker/run-fetch.sh

touch /tmp/weather-bootstrap-complete
cron -f
