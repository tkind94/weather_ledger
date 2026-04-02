# Weather Ledger — task runner
# Run `just --list` to see all recipes.

set dotenv-load := false

# ─── Lint ───────────────────────────────────────────────

[group('lint')]
lint: lint-frontend lint-python
    @echo "All linting passed."

[group('lint')]
lint-frontend:
    cd frontend && bun run lint

[group('lint')]
lint-python:
    cd data-pipeline && uv run ruff check .

# ─── Format ─────────────────────────────────────────────

[group('format')]
fmt: fmt-frontend fmt-python
    @echo "All formatting applied."

[group('format')]
fmt-frontend:
    cd frontend && bun run format

[group('format')]
fmt-python:
    cd data-pipeline && uv run ruff format .

[group('format')]
fmt-check: fmt-check-frontend fmt-check-python
    @echo "All format checks passed."

[group('format')]
fmt-check-frontend:
    cd frontend && bunx prettier --check .

[group('format')]
fmt-check-python:
    cd data-pipeline && uv run ruff format --check .

# ─── Type Check ─────────────────────────────────────────

[group('check')]
check: check-frontend
    @echo "All type checks passed."

[group('check')]
check-frontend:
    cd frontend && bun run check

# ─── Test ────────────────────────────────────────────────

[group('test')]
test: test-unit test-e2e
    @echo "All tests passed."

[group('test')]
test-unit:
    cd frontend && bun run test:unit -- --run

[group('test')]
test-e2e:
    cd frontend && bun run test:e2e

[group('test')]
test-journeys:
    cd frontend && CI=1 bun run test:e2e

[group('test')]
repro-location-lock:
    cd frontend && bun run test:unit -- --run src/lib/server/location-pipeline.spec.ts

# ─── Run ─────────────────────────────────────────────────

[group('run')]
dev:
    cd frontend && bun run dev

[group('run')]
preview: build
    cd frontend && bun run preview

# ─── Build ───────────────────────────────────────────────

[group('build')]
build:
    cd frontend && bun run build

# ─── Data Pipeline ───────────────────────────────────────

[group('data')]
fetch:
    cd data-pipeline && uv run python fetch.py

[group('data')]
dbt:
    cd data-pipeline && DBT_PROFILES_DIR="$PWD/.dbt" uv run dbt build

[group('data')]
pipeline: fetch dbt
    @echo "Data pipeline complete."

# ─── Review (full QC) ───────────────────────────────────

[group('review')]
review: lint check test-unit build
    @echo "Review passed — ready for PR."

# ─── Setup & Maintenance ────────────────────────────────

[group('setup')]
setup:
    cd data-pipeline && uv sync
    cd frontend && bun install
    cd frontend && bunx playwright install chromium
    prek install
    @echo "Local setup complete. Pre-commit hooks installed."

[group('setup')]
clean:
    rm -rf data-pipeline/target data-pipeline/logs
    rm -f data-pipeline/.dbt/.user.yml
    rm -rf frontend/build frontend/.svelte-kit
    rm -rf frontend/playwright-report frontend/test-results
    rm -f database/weather.duckdb
    @echo "Generated output removed."

[group('setup')]
validate: pipeline check test-unit build
    docker compose config > /dev/null
    @echo "Full validation complete."
