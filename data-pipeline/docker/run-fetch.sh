#!/bin/sh
set -eu

cd /app/data-pipeline
uv run python fetch.py