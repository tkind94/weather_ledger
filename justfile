# Weather Ledger — task runner
# Run `just --list` to see all recipes.

set dotenv-load := false

# ─── Lint ───────────────────────────────────────────────

[group('lint')]
lint: lint-frontend
    @echo "All linting passed."

[group('lint')]
lint-frontend:
    cd frontend && bun run lint

# ─── Format ─────────────────────────────────────────────

[group('format')]
fmt: fmt-frontend
    @echo "All formatting applied."

[group('format')]
fmt-frontend:
    cd frontend && bun run format

[group('format')]
fmt-check: fmt-check-frontend
    @echo "All format checks passed."

[group('format')]
fmt-check-frontend:
    cd frontend && bunx prettier --check .

# ─── Type Check ─────────────────────────────────────────

[group('check')]
check: check-frontend
    @echo "All type checks passed."

[group('check')]
check-frontend:
    cd frontend && bun run check

# ─── Test ────────────────────────────────────────────────

[group('test')]
test: test-unit
    @echo "All tests passed."

[group('test')]
test-unit:
    cd frontend && bun run test:unit

# ─── Run ─────────────────────────────────────────────────

[group('run')]
dev:
    cd frontend && bun run dev

[group('run')]
start: build
    cd frontend && bun run start

# ─── Build ───────────────────────────────────────────────

[group('build')]
build:
    cd frontend && bun run build

# ─── Review (full QC) ───────────────────────────────────

[group('review')]
review: lint check test-unit build
    @echo "Review passed — ready for PR."

# ─── Setup & Maintenance ────────────────────────────────

[group('setup')]
setup:
    cd frontend && bun install
    prek install
    @echo "Local setup complete. Pre-commit hooks installed."

[group('setup')]
clean:
    rm -rf frontend/.next frontend/build frontend/test-results
    rm -f database/weather.sqlite3
    @echo "Generated output removed."

[group('setup')]
validate: lint check test-unit build
    docker compose config > /dev/null
    @echo "Full validation complete."
