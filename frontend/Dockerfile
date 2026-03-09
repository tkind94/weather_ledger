FROM oven/bun:1.3.10

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

EXPOSE 3000

CMD ["bun", "./build/index.js"]