from __future__ import annotations

import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import duckdb

from build_snapshot import build_snapshot


def seed_ledger(ledger_path: Path) -> None:
    with sqlite3.connect(ledger_path) as connection:
        connection.execute(
            """
            CREATE TABLE raw_locations (
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
            CREATE TABLE raw_weather (
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
        connection.execute(
            """
            INSERT INTO raw_locations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "fort-collins-colorado-us",
                "Fort Collins, Colorado, United States",
                "Colorado",
                "United States",
                "US",
                40.5852,
                -105.0844,
                "America/Denver",
                "configured",
                "2026-03-14T09:00:00Z",
                "2026-03-15T09:00:00Z",
            ),
        )
        connection.execute(
            """
            INSERT INTO raw_weather VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "fort-collins-colorado-us",
                "2026-03-14",
                40.5852,
                -105.0844,
                "America/Denver",
                12.8,
                1.4,
                7.1,
                2.3,
                22.1,
                41.0,
                315,
                1014.5,
                "open-meteo-historical",
                "2026-03-15T09:00:00Z",
            ),
        )


class SnapshotBuilderTest(unittest.TestCase):
    def test_build_snapshot_copies_raw_tables_from_sqlite(self) -> None:
        with TemporaryDirectory() as temp_dir:
            ledger_path = Path(temp_dir) / "weather.sqlite3"
            snapshot_path = Path(temp_dir) / "weather.duckdb"
            seed_ledger(ledger_path)

            build_snapshot(ledger_path, snapshot_path)

            with duckdb.connect(str(snapshot_path), read_only=True) as connection:
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM raw_locations").fetchone()[0],
                    1,
                )
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM raw_weather").fetchone()[0],
                    1,
                )
                self.assertEqual(
                    connection.execute(
                        "SELECT canonical_name FROM raw_locations WHERE location_key = ?",
                        ["fort-collins-colorado-us"],
                    ).fetchone()[0],
                    "Fort Collins, Colorado, United States",
                )


if __name__ == "__main__":
    unittest.main()
