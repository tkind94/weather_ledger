from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
from pathlib import Path
import time
from zoneinfo import ZoneInfo

import duckdb
import requests


API_URL = "https://archive-api.open-meteo.com/v1/archive"
LATITUDE = 40.5852
LONGITUDE = -105.0844
TIMEZONE = "America/Denver"
DATABASE_PATH = Path(__file__).resolve().parent.parent / "database" / "weather.duckdb"
REQUEST_TIMEOUT_SECONDS = 30
RETRY_BACKOFF_SECONDS = (1.0, 3.0, 7.0)

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class WeatherDay:
    weather_date: str
    latitude: float
    longitude: float
    timezone: str
    max_temperature_c: float
    precipitation_mm: float
    source: str
    fetched_at: str


def resolve_date_window() -> tuple[str, str]:
    today = datetime.now(ZoneInfo(TIMEZONE)).date()
    end_date = today - timedelta(days=1)
    start_date = end_date - timedelta(days=6)
    return start_date.isoformat(), end_date.isoformat()


def fetch_payload(start_date: str, end_date: str) -> dict[str, object]:
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "precipitation_sum,temperature_2m_max",
        "timezone": TIMEZONE,
    }
    last_error: Exception | None = None

    for attempt, backoff_seconds in enumerate((0.0, *RETRY_BACKOFF_SECONDS), start=1):
        if backoff_seconds:
            time.sleep(backoff_seconds)

        try:
            response = requests.get(API_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as error:
            last_error = error
            LOGGER.warning("Open-Meteo request attempt %s failed: %s", attempt, error)
            continue

        if not isinstance(payload, dict):
            raise ValueError("Open-Meteo payload must be a JSON object")

        return payload

    raise RuntimeError("Open-Meteo request failed after all retries") from last_error


def require_daily_series(payload: dict[str, object], key: str) -> list[object]:
    daily = payload.get("daily")
    if not isinstance(daily, dict):
        raise ValueError("Open-Meteo payload is missing a daily object")

    series = daily.get(key)
    if not isinstance(series, list):
        raise ValueError(f"Open-Meteo payload is missing daily.{key}")

    return series


def fetch_history() -> list[WeatherDay]:
    start_date, end_date = resolve_date_window()
    payload = fetch_payload(start_date, end_date)
    fetched_at = datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds")

    dates = [str(value) for value in require_daily_series(payload, "time")]
    max_temperatures = [float(value) for value in require_daily_series(payload, "temperature_2m_max")]
    precipitation = [float(value) for value in require_daily_series(payload, "precipitation_sum")]

    return [
        WeatherDay(
            weather_date=weather_date,
            latitude=LATITUDE,
            longitude=LONGITUDE,
            timezone=TIMEZONE,
            max_temperature_c=max_temperature_c,
            precipitation_mm=precipitation_mm,
            source="open-meteo-historical",
            fetched_at=fetched_at,
        )
        for weather_date, max_temperature_c, precipitation_mm in zip(
            dates,
            max_temperatures,
            precipitation,
            strict=True,
        )
    ]


def ensure_schema(connection: duckdb.DuckDBPyConnection) -> None:
    connection.execute(
        """
		CREATE TABLE IF NOT EXISTS raw_weather (
			weather_date DATE PRIMARY KEY,
			latitude DOUBLE NOT NULL,
			longitude DOUBLE NOT NULL,
			timezone VARCHAR NOT NULL,
			max_temperature_c DOUBLE NOT NULL,
			precipitation_mm DOUBLE NOT NULL,
			source VARCHAR NOT NULL,
			fetched_at TIMESTAMP NOT NULL
		)
		"""
    )


def store_history(rows: list[WeatherDay]) -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(DATABASE_PATH)) as connection:
        ensure_schema(connection)
        connection.executemany(
            """
		INSERT INTO raw_weather (
			weather_date,
			latitude,
			longitude,
			timezone,
			max_temperature_c,
			precipitation_mm,
			source,
			fetched_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (weather_date) DO UPDATE SET
			latitude = excluded.latitude,
			longitude = excluded.longitude,
			timezone = excluded.timezone,
			max_temperature_c = excluded.max_temperature_c,
			precipitation_mm = excluded.precipitation_mm,
			source = excluded.source,
			fetched_at = excluded.fetched_at
		""",
            [
                (
                    row.weather_date,
                    row.latitude,
                    row.longitude,
                    row.timezone,
                    row.max_temperature_c,
                    row.precipitation_mm,
                    row.source,
                    row.fetched_at,
                )
                for row in rows
            ],
        )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    rows = fetch_history()
    store_history(rows)
    LOGGER.info("Stored %s daily weather rows in %s", len(rows), DATABASE_PATH)


if __name__ == "__main__":
    main()
