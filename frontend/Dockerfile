FROM oven/bun:1.3.10

RUN apt-get update \
	&& apt-get install --yes --no-install-recommends python3 make g++ ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
