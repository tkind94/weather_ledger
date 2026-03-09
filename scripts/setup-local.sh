#!/bin/sh
set -eu

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

cd "$repo_root/data-pipeline"
uv sync

cd "$repo_root/frontend"
bun install
bunx playwright install chromium

printf '\nLocal setup complete.\n'