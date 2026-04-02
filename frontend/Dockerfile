FROM oven/bun:1.3.10

COPY --from=ghcr.io/astral-sh/uv:python3.12-bookworm-slim /uv /usr/local/bin/uv
COPY --from=ghcr.io/astral-sh/uv:python3.12-bookworm-slim /uvx /usr/local/bin/uvx

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends python3 ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

WORKDIR /app/data-pipeline
COPY data-pipeline/pyproject.toml data-pipeline/uv.lock data-pipeline/README.md ./
COPY data-pipeline/.dbt ./.dbt
RUN uv sync --frozen --no-dev --no-install-project

COPY data-pipeline/ ./
RUN uv sync --frozen --no-dev

WORKDIR /app/frontend
COPY frontend/ ./
RUN bun run build

EXPOSE 3000

CMD ["bun", "./build/index.js"]
