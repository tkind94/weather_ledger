#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

rm -rf "$repo_root/data-pipeline/target"
rm -rf "$repo_root/data-pipeline/logs"
rm -f "$repo_root/data-pipeline/.dbt/.user.yml"
rm -rf "$repo_root/frontend/build"
rm -rf "$repo_root/frontend/.svelte-kit"
rm -rf "$repo_root/frontend/playwright-report"
rm -rf "$repo_root/frontend/test-results"
rm -f "$repo_root/database/weather.duckdb"

printf '\nGenerated output removed.\n'
