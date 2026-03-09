# Contributing

This repository is small on purpose. Keep changes narrow, verify the full local data flow, and avoid checking in generated output.

## Development setup

```sh
./scripts/setup-local.sh
```

## Required validation

Run this before opening a review:

```sh
./scripts/validate.sh
```

That covers:

- Python ingestion against the shared DuckDB file
- dbt model execution
- Svelte typechecking
- frontend unit tests
- frontend production build
- Docker Compose config validation

## Cleanup

Generated files should stay out of source control. To remove local build output and the generated DuckDB file:

```sh
./scripts/clean.sh
```

Recreate the local database afterward with:

```sh
cd data-pipeline && uv run python fetch.py
```

## Tooling rules

- Use Bun for Node and TypeScript work.
- Use `uv` for Python dependencies and commands.
- Keep DuckDB access in server-only frontend modules.
- Treat `database/weather.duckdb` as local generated state, not source.
