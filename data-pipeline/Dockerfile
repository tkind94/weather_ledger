FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends cron \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app/data-pipeline

COPY data-pipeline/pyproject.toml data-pipeline/uv.lock data-pipeline/README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY data-pipeline/ ./

RUN uv sync --frozen --no-dev

RUN chmod +x docker/run-fetch.sh docker/start-cron.sh \
	&& chmod 0644 docker/weather-fetch.cron \
	&& cp docker/weather-fetch.cron /etc/cron.d/weather-fetch \
	&& touch /var/log/weather-fetch.log

CMD ["./docker/start-cron.sh"]