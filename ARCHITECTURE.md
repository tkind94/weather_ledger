# Architecture Design: Weather Ledger

## Overview
Weather Ledger is a self-hosted, local-first web application designed to track, aggregate, and visualize historical and daily weather statistics. It avoids heavy frontend frameworks in favor of Server-Side Rendering (SSR) and utilizes a modern, file-based data stack.

## Tech Stack
* **Frontend/Backend:** SvelteKit (TypeScript) powered by Bun.
* **Data Ingestion:** Python managed by `uv`.
* **Data Transformation:** dbt (Core) via `dbt-duckdb`.
* **Database:** DuckDB (local `.duckdb` file).
* **Visualizations:** Apache ECharts.
* **Deployment:** Docker Compose (local Mini PC), exposed via Cloudflare Tunnels.

## System Architecture

1.  **Ingestion Layer (Python + cron/systemd):**
    * A Python script (`fetch.py`) runs daily.
    * Pulls the previous day's weather data from the Open-Meteo API (Target coordinates: 40.5852, -105.0844 for Fort Collins, CO).
    * Appends the raw JSON/Parquet payload into `database/weather.duckdb` (table: `raw_weather`).

2.  **Transformation Layer (dbt):**
    * The Python script triggers a `dbt build` via subprocess.
    * **Staging:** Cleans names, casts types (e.g., `stg_open_meteo`).
    * **Marts:** Calculates aggregations using window functions (e.g., `fct_rolling_precipitation`, `fct_monthly_highs`).

3.  **Application Layer (SvelteKit):**
    * SvelteKit server routes (`+page.server.ts`) connect directly to `database/weather.duckdb` in read-only mode.
    * Executes simple `SELECT * FROM fct_monthly_highs` queries.
    * Passes strongly typed data to Svelte pages (`+page.svelte`).

4.  **Presentation Layer:**
    * Svelte renders the HTML shell.
    * ECharts mounts on the client to render interactive data visualizations based on the server-provided data.
