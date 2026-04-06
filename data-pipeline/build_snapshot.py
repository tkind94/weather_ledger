from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import duckdb

from storage_paths import resolve_ledger_path, resolve_snapshot_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a DuckDB snapshot from the SQLite ledger")
    parser.add_argument("--output-path", type=Path)
    return parser.parse_args()


def resolve_output_path(output_path: Path | None) -> Path:
    if output_path is not None:
        return output_path

    return resolve_snapshot_path()


def ensure_ledger_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS raw_locations (
            location_key TEXT PRIMARY KEY,
            canonical_name TEXT NOT NULL,
            admin1 TEXT,
            country TEXT,
            country_code TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timezone TEXT NOT NULL,
            geocode_source TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS raw_weather (
            location_key TEXT NOT NULL,
            weather_date TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            timezone TEXT NOT NULL,
            max_temperature_c REAL NOT NULL,
            min_temperature_c REAL NOT NULL,
            avg_temperature_c REAL NOT NULL,
            precipitation_mm REAL NOT NULL,
            wind_speed_kph REAL NOT NULL,
            wind_gust_kph REAL NOT NULL,
            wind_direction_deg REAL NOT NULL,
            pressure_hpa REAL NOT NULL,
            source TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            PRIMARY KEY (location_key, weather_date)
        )
        """
    )


def ensure_snapshot_schema(connection: duckdb.DuckDBPyConnection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS raw_locations (
            location_key VARCHAR PRIMARY KEY,
            canonical_name VARCHAR NOT NULL,
            admin1 VARCHAR,
            country VARCHAR,
            country_code VARCHAR,
            latitude DOUBLE NOT NULL,
            longitude DOUBLE NOT NULL,
            timezone VARCHAR NOT NULL,
            geocode_source VARCHAR NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS raw_weather (
            location_key VARCHAR NOT NULL,
            weather_date DATE NOT NULL,
            latitude DOUBLE NOT NULL,
            longitude DOUBLE NOT NULL,
            timezone VARCHAR NOT NULL,
            max_temperature_c DOUBLE NOT NULL,
            min_temperature_c DOUBLE NOT NULL,
            avg_temperature_c DOUBLE NOT NULL,
            precipitation_mm DOUBLE NOT NULL,
            wind_speed_kph DOUBLE NOT NULL,
            wind_gust_kph DOUBLE NOT NULL,
            wind_direction_deg DOUBLE NOT NULL,
            pressure_hpa DOUBLE NOT NULL,
            source VARCHAR NOT NULL,
            fetched_at TIMESTAMP NOT NULL,
            PRIMARY KEY (location_key, weather_date)
        )
        """
    )


def ledger_rows(connection: sqlite3.Connection, query: str) -> list[tuple[object, ...]]:
    return [tuple(row) for row in connection.execute(query).fetchall()]


def build_snapshot(ledger_path: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    with sqlite3.connect(ledger_path) as ledger_connection:
        ensure_ledger_schema(ledger_connection)

        with duckdb.connect(str(output_path)) as snapshot_connection:
            ensure_snapshot_schema(snapshot_connection)

            location_rows = ledger_rows(
                ledger_connection,
                """
                SELECT
                    location_key,
                    canonical_name,
                    admin1,
                    country,
                    country_code,
                    latitude,
                    longitude,
                    timezone,
                    geocode_source,
                    created_at,
                    updated_at
                FROM raw_locations
                ORDER BY location_key
                """,
            )
            if location_rows:
                snapshot_connection.executemany(
                    """
                    INSERT INTO raw_locations (
                        location_key,
                        canonical_name,
                        admin1,
                        country,
                        country_code,
                        latitude,
                        longitude,
                        timezone,
                        geocode_source,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    location_rows,
                )

            weather_rows = ledger_rows(
                ledger_connection,
                """
                SELECT
                    location_key,
                    weather_date,
                    latitude,
                    longitude,
                    timezone,
                    max_temperature_c,
                    min_temperature_c,
                    avg_temperature_c,
                    precipitation_mm,
                    wind_speed_kph,
                    wind_gust_kph,
                    wind_direction_deg,
                    pressure_hpa,
                    source,
                    fetched_at
                FROM raw_weather
                ORDER BY location_key, weather_date
                """,
            )
            if weather_rows:
                snapshot_connection.executemany(
                    """
                    INSERT INTO raw_weather (
                        location_key,
                        weather_date,
                        latitude,
                        longitude,
                        timezone,
                        max_temperature_c,
                        min_temperature_c,
                        avg_temperature_c,
                        precipitation_mm,
                        wind_speed_kph,
                        wind_gust_kph,
                        wind_direction_deg,
                        pressure_hpa,
                        source,
                        fetched_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    weather_rows,
                )


def main() -> None:
    args = parse_args()
    build_snapshot(resolve_ledger_path(), resolve_output_path(args.output_path))


if __name__ == "__main__":
    main()
