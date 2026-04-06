from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sqlite3
import time
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb
import requests

from storage_paths import resolve_ledger_path, resolve_snapshot_path

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
REQUEST_TIMEOUT_SECONDS = 30
RETRY_BACKOFF_SECONDS = (1.0, 3.0, 7.0)
INITIAL_BACKFILL_DAYS = int(os.environ.get("WEATHER_LEDGER_INITIAL_BACKFILL_DAYS", "30"))
DEFAULT_LOCATION_KEY = os.environ.get(
    "WEATHER_LEDGER_DEFAULT_LOCATION_KEY", "fort-collins-colorado-us"
)
DEFAULT_LOCATION_NAME = os.environ.get(
    "WEATHER_LEDGER_DEFAULT_LOCATION_NAME", "Fort Collins, Colorado, United States"
)
DEFAULT_LOCATION_LATITUDE = float(
    os.environ.get("WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE", "40.5852")
)
DEFAULT_LOCATION_LONGITUDE = float(
    os.environ.get("WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE", "-105.0844")
)
DEFAULT_LOCATION_TIMEZONE = os.environ.get(
    "WEATHER_LEDGER_DEFAULT_LOCATION_TIMEZONE", "America/Denver"
)
USER_AGENT = os.environ.get("WEATHER_LEDGER_USER_AGENT", "weather-ledger/0.2")

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class RequestedLocation:
    latitude: float
    longitude: float
    location_key: str | None
    location_name: str | None
    timezone: str | None


@dataclass(frozen=True)
class ResolvedLocation:
    location_key: str
    canonical_name: str
    latitude: float
    longitude: float
    timezone: str
    admin1: str | None
    country: str | None
    country_code: str | None
    geocode_source: str


@dataclass(frozen=True)
class FetchWindow:
    start_date: str
    end_date: str


@dataclass(frozen=True)
class WeatherDay:
    location_key: str
    weather_date: str
    latitude: float
    longitude: float
    timezone: str
    max_temperature_c: float
    min_temperature_c: float
    avg_temperature_c: float
    precipitation_mm: float
    wind_speed_kph: float
    wind_gust_kph: float
    wind_direction_deg: float
    pressure_hpa: float
    source: str
    fetched_at: str


@dataclass(frozen=True)
class IngestionResult:
    location_key: str
    canonical_name: str
    latitude: float
    longitude: float
    timezone: str
    rows_stored: int
    start_date: str | None
    end_date: str | None
    existing_location: bool


def snake_to_camel(key: str) -> str:
    head, *tail = key.split("_")
    return head + "".join(part.capitalize() for part in tail)


def as_frontend_payload(result: IngestionResult) -> dict[str, object]:
    return {snake_to_camel(key): value for key, value in asdict(result).items()}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and store weather data by location")
    parser.add_argument("--latitude", type=float, default=DEFAULT_LOCATION_LATITUDE)
    parser.add_argument("--longitude", type=float, default=DEFAULT_LOCATION_LONGITUDE)
    parser.add_argument("--location-key")
    parser.add_argument("--location-name")
    parser.add_argument("--timezone")
    parser.add_argument("--json", action="store_true", dest="as_json")
    return parser.parse_args()


def request_json(
    url: str,
    params: dict[str, object],
    *,
    headers: dict[str, str] | None = None,
) -> dict[str, object]:
    last_error: Exception | None = None

    for attempt, backoff_seconds in enumerate((0.0, *RETRY_BACKOFF_SECONDS), start=1):
        if backoff_seconds:
            time.sleep(backoff_seconds)

        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as error:
            last_error = error
            LOGGER.warning("Request attempt %s failed for %s: %s", attempt, url, error)
            continue

        if not isinstance(payload, dict):
            raise ValueError(f"Expected JSON object from {url}")

        return payload

    raise RuntimeError(f"Request failed after all retries: {url}") from last_error


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    collapsed = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text.strip().lower())
    slug = collapsed.strip("-")
    if not slug:
        raise ValueError("Location key segments must not be empty")
    return slug


def build_location_key(name: str, admin1: str | None, country_code: str | None) -> str:
    parts = [name]
    if admin1:
        parts.append(admin1)
    if country_code:
        parts.append(country_code)
    return "-".join(slugify(part) for part in parts)


def first_non_empty(values: tuple[str | None, ...]) -> str | None:
    for value in values:
        if value and value.strip():
            return value.strip()
    return None


def reverse_geocode(latitude: float, longitude: float) -> dict[str, str | None]:
    payload = request_json(
        NOMINATIM_REVERSE_URL,
        {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "zoom": 10,
            "addressdetails": 1,
        },
        headers={"User-Agent": USER_AGENT},
    )
    address = payload.get("address")
    if not isinstance(address, dict):
        raise ValueError("Reverse geocoding response is missing an address")

    city = first_non_empty(
        (
            as_optional_str(address.get("city")),
            as_optional_str(address.get("town")),
            as_optional_str(address.get("village")),
            as_optional_str(address.get("municipality")),
            as_optional_str(address.get("county")),
            as_optional_str(address.get("state_district")),
            as_optional_str(address.get("state")),
        )
    )
    if city is None:
        raise ValueError("Reverse geocoding could not determine a common place name")

    return {
        "name": city,
        "admin1": first_non_empty(
            (
                as_optional_str(address.get("state")),
                as_optional_str(address.get("region")),
                as_optional_str(address.get("county")),
            )
        ),
        "country": as_optional_str(address.get("country")),
        "country_code": normalize_country_code(address.get("country_code")),
    }


def as_optional_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def normalize_country_code(value: object) -> str | None:
    text = as_optional_str(value)
    if text is None:
        return None
    return text.upper()


def build_canonical_name(name: str, admin1: str | None, country: str | None) -> str:
    parts = [name]
    if admin1:
        parts.append(admin1)
    if country:
        parts.append(country)
    return ", ".join(parts)


def squared_distance(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    return ((latitude_a - latitude_b) ** 2) + ((longitude_a - longitude_b) ** 2)


def resolve_location_from_geocoders(latitude: float, longitude: float) -> ResolvedLocation:
    reverse = reverse_geocode(latitude, longitude)
    reverse_name = reverse["name"]
    if reverse_name is None:
        raise ValueError("Reverse geocoding did not return a location name")

    payload = request_json(
        OPEN_METEO_GEOCODING_URL,
        {
            "name": reverse_name,
            "count": 10,
            "language": "en",
            "format": "json",
            "countryCode": reverse["country_code"] or "",
        },
    )
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        raise ValueError("Forward geocoding did not return any matching locations")

    best_result = min(
        [candidate for candidate in results if isinstance(candidate, dict)],
        key=lambda candidate: score_geocode_candidate(candidate, reverse, latitude, longitude),
    )

    name = require_str(best_result, "name")
    admin1 = as_optional_str(best_result.get("admin1")) or reverse["admin1"]
    country = as_optional_str(best_result.get("country")) or reverse["country"]
    country_code = (
        normalize_country_code(best_result.get("country_code")) or reverse["country_code"]
    )
    timezone = require_str(best_result, "timezone")
    canonical_name = build_canonical_name(name, admin1, country)

    return ResolvedLocation(
        location_key=build_location_key(name, admin1, country_code),
        canonical_name=canonical_name,
        latitude=float(best_result.get("latitude", latitude)),
        longitude=float(best_result.get("longitude", longitude)),
        timezone=timezone,
        admin1=admin1,
        country=country,
        country_code=country_code,
        geocode_source="open-meteo-geocoding",
    )


def score_geocode_candidate(
    candidate: dict[str, object],
    reverse: dict[str, str | None],
    latitude: float,
    longitude: float,
) -> tuple[int, int, float]:
    candidate_name = as_optional_str(candidate.get("name"))
    candidate_admin1 = as_optional_str(candidate.get("admin1"))
    candidate_country_code = normalize_country_code(candidate.get("country_code"))

    name_penalty = 0 if candidate_name == reverse["name"] else 1
    admin_penalty = 0 if candidate_admin1 == reverse["admin1"] else 1
    country_penalty = 0 if candidate_country_code == reverse["country_code"] else 1

    return (
        name_penalty,
        admin_penalty + country_penalty,
        squared_distance(
            float(candidate.get("latitude", latitude)),
            float(candidate.get("longitude", longitude)),
            latitude,
            longitude,
        ),
    )


def require_str(payload: dict[str, object], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Expected non-empty string for {key}")
    return value


def resolve_requested_location(requested: RequestedLocation) -> ResolvedLocation:
    if requested.location_key and requested.location_name and requested.timezone:
        return ResolvedLocation(
            location_key=requested.location_key,
            canonical_name=requested.location_name,
            latitude=requested.latitude,
            longitude=requested.longitude,
            timezone=requested.timezone,
            admin1=None,
            country=None,
            country_code=None,
            geocode_source="configured",
        )

    return resolve_location_from_geocoders(requested.latitude, requested.longitude)


def table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    result = connection.execute(
        """
        SELECT COUNT(*)
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
        """,
        [table_name],
    ).fetchone()
    return bool(result and result[0])


def table_has_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
) -> bool:
    # PRAGMA table_info does not accept bound parameters, so callers must pass a trusted
    # internal table name rather than user input.
    columns = connection.execute(f"PRAGMA table_info('{table_name}')").fetchall()
    return any(column[1] == column_name for column in columns)


def ensure_schema(connection: sqlite3.Connection) -> None:
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


def configure_ledger_connection(connection: sqlite3.Connection) -> None:
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 5000")


def ledger_table_has_rows(connection: sqlite3.Connection, table_name: str) -> bool:
    if not table_exists(connection, table_name):
        return False

    result = connection.execute(f"SELECT 1 FROM {table_name} LIMIT 1").fetchone()
    return result is not None


def snapshot_table_exists(connection: duckdb.DuckDBPyConnection, table_name: str) -> bool:
    result = connection.execute(
        """
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'main' AND table_name = ?
        """,
        [table_name],
    ).fetchone()
    return bool(result and result[0])


def snapshot_table_has_column(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    column_name: str,
) -> bool:
    columns = connection.execute(f"PRAGMA table_info('{table_name}')").fetchall()
    return any(column[1] == column_name for column in columns)


def migrate_snapshot_raw_data_to_ledger(
    connection: sqlite3.Connection,
    snapshot_path: Path,
) -> None:
    if ledger_table_has_rows(connection, "raw_locations") or ledger_table_has_rows(
        connection, "raw_weather"
    ):
        return
    if not snapshot_path.exists():
        return

    with duckdb.connect(str(snapshot_path), read_only=True) as snapshot_connection:
        if not snapshot_table_exists(snapshot_connection, "raw_weather"):
            return

        LOGGER.info(
            "Migrating raw weather cache from %s into %s",
            snapshot_path,
            resolve_ledger_path(),
        )

        if snapshot_table_exists(snapshot_connection, "raw_locations"):
            location_rows = snapshot_connection.execute(
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
                """
            ).fetchall()
            if location_rows:
                connection.executemany(
                    """
                    INSERT OR REPLACE INTO raw_locations (
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

        if snapshot_table_has_column(snapshot_connection, "raw_weather", "location_key"):
            weather_rows = snapshot_connection.execute(
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
                """
            ).fetchall()
        else:
            legacy_location = default_legacy_location()
            timestamp = datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds")
            upsert_location(connection, legacy_location, timestamp)
            weather_rows = snapshot_connection.execute(
                """
                SELECT
                    ?,
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
                """,
                [legacy_location.location_key],
            ).fetchall()

        if weather_rows:
            connection.executemany(
                """
                INSERT OR REPLACE INTO raw_weather (
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


def default_legacy_location() -> ResolvedLocation:
    return ResolvedLocation(
        location_key=DEFAULT_LOCATION_KEY,
        canonical_name=DEFAULT_LOCATION_NAME,
        latitude=DEFAULT_LOCATION_LATITUDE,
        longitude=DEFAULT_LOCATION_LONGITUDE,
        timezone=DEFAULT_LOCATION_TIMEZONE,
        admin1=None,
        country=None,
        country_code=None,
        geocode_source="legacy-migration",
    )


def migrate_legacy_schema(connection: sqlite3.Connection) -> None:
    if not table_exists(connection, "raw_weather"):
        return
    if table_has_column(connection, "raw_weather", "location_key"):
        return

    LOGGER.info("Migrating legacy raw_weather schema to location-aware schema")
    legacy_location = default_legacy_location()
    now_timestamp = datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds")

    connection.execute("ALTER TABLE raw_weather RENAME TO raw_weather_legacy")
    ensure_schema(connection)
    upsert_location(connection, legacy_location, now_timestamp)
    connection.execute(
        """
        INSERT OR REPLACE INTO raw_weather (
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
        SELECT
            ?,
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
        FROM raw_weather_legacy
        """,
        [legacy_location.location_key],
    )
    connection.execute("DROP TABLE raw_weather_legacy")


def load_existing_location(
    connection: sqlite3.Connection,
    location_key: str,
) -> ResolvedLocation | None:
    row = connection.execute(
        """
        SELECT
            location_key,
            canonical_name,
            latitude,
            longitude,
            timezone,
            admin1,
            country,
            country_code,
            geocode_source
        FROM raw_locations
        WHERE location_key = ?
        """,
        [location_key],
    ).fetchone()
    if row is None:
        return None

    return ResolvedLocation(
        location_key=row[0],
        canonical_name=row[1],
        latitude=float(row[2]),
        longitude=float(row[3]),
        timezone=row[4],
        admin1=row[5],
        country=row[6],
        country_code=row[7],
        geocode_source=row[8],
    )


def upsert_location(
    connection: sqlite3.Connection,
    location: ResolvedLocation,
    timestamp: str,
) -> None:
    existing_created_at = connection.execute(
        "SELECT created_at FROM raw_locations WHERE location_key = ?",
        [location.location_key],
    ).fetchone()
    created_at = existing_created_at[0] if existing_created_at else timestamp

    connection.execute(
        """
        INSERT OR REPLACE INTO raw_locations (
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
        [
            location.location_key,
            location.canonical_name,
            location.admin1,
            location.country,
            location.country_code,
            location.latitude,
            location.longitude,
            location.timezone,
            location.geocode_source,
            created_at,
            timestamp,
        ],
    )


def parse_sql_date(value: object) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError(f"Unsupported SQL date value: {value!r}")


def resolve_date_window(
    connection: sqlite3.Connection,
    location: ResolvedLocation,
) -> FetchWindow | None:
    today = datetime.now(ZoneInfo(location.timezone)).date()
    end_date = today - timedelta(days=1)
    max_date_row = connection.execute(
        "SELECT max(weather_date) FROM raw_weather WHERE location_key = ?",
        [location.location_key],
    ).fetchone()
    max_date = parse_sql_date(max_date_row[0] if max_date_row else None)

    if max_date is None:
        start_date = end_date - timedelta(days=INITIAL_BACKFILL_DAYS - 1)
    else:
        start_date = max_date + timedelta(days=1)

    if start_date > end_date:
        return None

    return FetchWindow(start_date.isoformat(), end_date.isoformat())


def fetch_payload(
    location: ResolvedLocation,
    start_date: str,
    end_date: str,
) -> dict[str, object]:
    return request_json(
        OPEN_METEO_ARCHIVE_URL,
        {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "start_date": start_date,
            "end_date": end_date,
            "daily": (
                "temperature_2m_max,temperature_2m_min,temperature_2m_mean,"
                "precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,"
                "wind_direction_10m_dominant,pressure_msl_mean"
            ),
            "timezone": location.timezone,
        },
    )


def require_daily_series(
    payload: dict[str, object],
    key: str,
) -> list[float | int | str]:
    daily = payload.get("daily")
    if not isinstance(daily, dict):
        raise ValueError("Open-Meteo payload is missing a daily object")

    series = daily.get(key)
    if not isinstance(series, list):
        raise ValueError(f"Open-Meteo payload is missing daily.{key}")

    return series


def fetch_history(
    location: ResolvedLocation,
    fetch_window: FetchWindow,
) -> list[WeatherDay]:
    payload = fetch_payload(location, fetch_window.start_date, fetch_window.end_date)
    fetched_at = datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds")

    dates = [str(value) for value in require_daily_series(payload, "time")]
    max_temperatures = [
        float(value) for value in require_daily_series(payload, "temperature_2m_max")
    ]
    min_temperatures = [
        float(value) for value in require_daily_series(payload, "temperature_2m_min")
    ]
    avg_temperatures = [
        float(value) for value in require_daily_series(payload, "temperature_2m_mean")
    ]
    precipitation = [float(value) for value in require_daily_series(payload, "precipitation_sum")]
    wind_speed = [float(value) for value in require_daily_series(payload, "wind_speed_10m_max")]
    wind_gust = [float(value) for value in require_daily_series(payload, "wind_gusts_10m_max")]
    wind_direction = [
        float(value) for value in require_daily_series(payload, "wind_direction_10m_dominant")
    ]
    pressure = [float(value) for value in require_daily_series(payload, "pressure_msl_mean")]

    return [
        WeatherDay(
            location_key=location.location_key,
            weather_date=weather_date,
            latitude=location.latitude,
            longitude=location.longitude,
            timezone=location.timezone,
            max_temperature_c=max_temperature_c,
            min_temperature_c=min_temperature_c,
            avg_temperature_c=avg_temperature_c,
            precipitation_mm=precipitation_mm,
            wind_speed_kph=wind_speed_kph,
            wind_gust_kph=wind_gust_kph,
            wind_direction_deg=wind_direction_deg,
            pressure_hpa=pressure_hpa,
            source="open-meteo-historical",
            fetched_at=fetched_at,
        )
        for (
            weather_date,
            max_temperature_c,
            min_temperature_c,
            avg_temperature_c,
            precipitation_mm,
            wind_speed_kph,
            wind_gust_kph,
            wind_direction_deg,
            pressure_hpa,
        ) in zip(
            dates,
            max_temperatures,
            min_temperatures,
            avg_temperatures,
            precipitation,
            wind_speed,
            wind_gust,
            wind_direction,
            pressure,
            strict=True,
        )
    ]


def store_history(
    connection: sqlite3.Connection,
    rows: list[WeatherDay],
) -> None:
    if not rows:
        return

    connection.executemany(
        """
        INSERT OR REPLACE INTO raw_weather (
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
        [
            (
                row.location_key,
                row.weather_date,
                row.latitude,
                row.longitude,
                row.timezone,
                row.max_temperature_c,
                row.min_temperature_c,
                row.avg_temperature_c,
                row.precipitation_mm,
                row.wind_speed_kph,
                row.wind_gust_kph,
                row.wind_direction_deg,
                row.pressure_hpa,
                row.source,
                row.fetched_at,
            )
            for row in rows
        ],
    )


def ensure_location_data(requested: RequestedLocation) -> IngestionResult:
    ledger_path = resolve_ledger_path()
    snapshot_path = resolve_snapshot_path()
    ledger_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(ledger_path) as connection:
        configure_ledger_connection(connection)
        ensure_schema(connection)
        migrate_legacy_schema(connection)
        migrate_snapshot_raw_data_to_ledger(connection, snapshot_path)

        if requested.location_key:
            existing_by_key = load_existing_location(connection, requested.location_key)
        else:
            existing_by_key = None

        resolved_candidate = existing_by_key or resolve_requested_location(requested)
        existing_location = load_existing_location(connection, resolved_candidate.location_key)
        location = existing_location or resolved_candidate

        fetch_window = resolve_date_window(connection, location)
        rows = fetch_history(location, fetch_window) if fetch_window else []
        timestamp = datetime.now(ZoneInfo("UTC")).isoformat(timespec="seconds")

        upsert_location(connection, location, timestamp)
        store_history(connection, rows)

    return IngestionResult(
        location_key=location.location_key,
        canonical_name=location.canonical_name,
        latitude=location.latitude,
        longitude=location.longitude,
        timezone=location.timezone,
        rows_stored=len(rows),
        start_date=fetch_window.start_date if fetch_window else None,
        end_date=fetch_window.end_date if fetch_window else None,
        existing_location=existing_location is not None,
    )


def log_result(result: IngestionResult, database_path: Path) -> None:
    LOGGER.info(
        "Location %s stored %s rows in %s",
        result.location_key,
        result.rows_stored,
        database_path,
    )


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    requested = RequestedLocation(
        latitude=args.latitude,
        longitude=args.longitude,
        location_key=args.location_key,
        location_name=args.location_name,
        timezone=args.timezone,
    )
    result = ensure_location_data(requested)
    database_path = resolve_ledger_path()

    if args.as_json:
        print(json.dumps(as_frontend_payload(result)))
    else:
        log_result(result, database_path)


if __name__ == "__main__":
    main()
