# Data Models

This project currently keeps the first data model intentionally small.

## Source: `raw_weather`

Written by `fetch.py` into `database/weather.duckdb`.

Columns:

- `weather_date`
- `latitude`
- `longitude`
- `timezone`
- `max_temperature_c`
- `precipitation_mm`
- `source`
- `fetched_at`

## Staging: `stg_raw_weather`

Purpose:

- cast source fields to explicit DuckDB types
- provide a stable dbt entry point above the raw source table

Materialization:

- view

## Mart: `fct_weather_history`

Purpose:

- provide an ordered history table for the frontend proof of concept
- serve as the first stable contract above staging while the project is still small

Materialization:

- table

Expected near-term growth:

- monthly and seasonal aggregates
- rolling precipitation windows
- temperature anomaly views