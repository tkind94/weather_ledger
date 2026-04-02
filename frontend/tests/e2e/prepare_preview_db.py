from __future__ import annotations

from pathlib import Path

import duckdb


TEST_DB_PATH = Path("/tmp/weather-ledger-test.duckdb")


def main() -> None:
    TEST_DB_PATH.unlink(missing_ok=True)
    connection = duckdb.connect(str(TEST_DB_PATH))

    connection.execute(
        """
        CREATE TABLE raw_locations (
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
        INSERT INTO raw_locations VALUES
            ('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', 40.5852, -105.0844, 'America/Denver', 'configured', '2026-03-14T09:00:00Z', '2026-03-15T09:00:00Z'),
            ('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', 40.01499, -105.27055, 'America/Denver', 'configured', '2026-03-14T09:00:00Z', '2026-03-15T09:00:00Z'),
            ('loveland-colorado-us', 'Loveland, Colorado, United States', 'Colorado', 'United States', 'US', 40.39776, -105.07498, 'America/Denver', 'configured', '2026-03-14T09:00:00Z', '2026-03-15T09:00:00Z')
        """
    )

    connection.execute(
        """
        CREATE TABLE raw_weather (
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
    connection.execute(
        """
        INSERT INTO raw_weather VALUES
            ('fort-collins-colorado-us', '2026-03-13', 40.5852, -105.0844, 'America/Denver', 15.2, 3.1, 9.2, 0.0, 18.5, 32.4, 270, 1018.2, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
            ('fort-collins-colorado-us', '2026-03-14', 40.5852, -105.0844, 'America/Denver', 12.8, 1.4, 7.1, 2.3, 22.1, 41.0, 315, 1014.5, 'open-meteo-historical', '2026-03-15T09:00:00Z'),
            ('boulder-colorado-us', '2026-03-13', 40.01499, -105.27055, 'America/Denver', 13.1, 2.0, 8.0, 1.1, 16.0, 28.5, 290, 1017.0, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
            ('boulder-colorado-us', '2026-03-14', 40.01499, -105.27055, 'America/Denver', 10.2, 0.6, 5.5, 4.8, 20.4, 36.0, 300, 1012.8, 'open-meteo-historical', '2026-03-15T09:00:00Z'),
            ('loveland-colorado-us', '2026-03-13', 40.39776, -105.07498, 'America/Denver', 14.4, 2.7, 8.9, 0.2, 17.8, 30.6, 265, 1016.9, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
            ('loveland-colorado-us', '2026-03-14', 40.39776, -105.07498, 'America/Denver', 11.1, 0.9, 6.4, 3.4, 21.7, 38.8, 305, 1013.7, 'open-meteo-historical', '2026-03-15T09:00:00Z')
        """
    )

    connection.execute(
        """
        CREATE TABLE weather_daily_history (
            location_key VARCHAR NOT NULL,
            canonical_name VARCHAR NOT NULL,
            admin1 VARCHAR,
            country VARCHAR,
            country_code VARCHAR,
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
            fetched_at TIMESTAMP NOT NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO weather_daily_history VALUES
            ('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-13', 40.5852, -105.0844, 'America/Denver', 15.2, 3.1, 9.2, 0.0, 18.5, 32.4, 270, 1018.2, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
            ('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-14', 40.5852, -105.0844, 'America/Denver', 12.8, 1.4, 7.1, 2.3, 22.1, 41.0, 315, 1014.5, 'open-meteo-historical', '2026-03-15T09:00:00Z'),
            ('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-13', 40.01499, -105.27055, 'America/Denver', 13.1, 2.0, 8.0, 1.1, 16.0, 28.5, 290, 1017.0, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
            ('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-14', 40.01499, -105.27055, 'America/Denver', 10.2, 0.6, 5.5, 4.8, 20.4, 36.0, 300, 1012.8, 'open-meteo-historical', '2026-03-15T09:00:00Z'),
            ('loveland-colorado-us', 'Loveland, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-13', 40.39776, -105.07498, 'America/Denver', 14.4, 2.7, 8.9, 0.2, 17.8, 30.6, 265, 1016.9, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
            ('loveland-colorado-us', 'Loveland, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-14', 40.39776, -105.07498, 'America/Denver', 11.1, 0.9, 6.4, 3.4, 21.7, 38.8, 305, 1013.7, 'open-meteo-historical', '2026-03-15T09:00:00Z')
        """
    )

    connection.execute(
        """
        CREATE TABLE location_catalog (
            location_key VARCHAR PRIMARY KEY,
            canonical_name VARCHAR NOT NULL,
            admin1 VARCHAR,
            country VARCHAR,
            country_code VARCHAR,
            latitude DOUBLE NOT NULL,
            longitude DOUBLE NOT NULL,
            timezone VARCHAR NOT NULL,
            observation_count BIGINT NOT NULL,
            first_observation_date DATE,
            latest_observation_date DATE,
            last_fetched_at TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        INSERT INTO location_catalog VALUES
            ('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', 40.5852, -105.0844, 'America/Denver', 2, '2026-03-13', '2026-03-14', '2026-03-15T09:00:00Z'),
            ('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', 40.01499, -105.27055, 'America/Denver', 2, '2026-03-13', '2026-03-14', '2026-03-15T09:00:00Z'),
            ('loveland-colorado-us', 'Loveland, Colorado, United States', 'Colorado', 'United States', 'US', 40.39776, -105.07498, 'America/Denver', 2, '2026-03-13', '2026-03-14', '2026-03-15T09:00:00Z')
        """
    )

    connection.execute(
        """
        CREATE TABLE weather_monthly_extremes (
            location_key VARCHAR NOT NULL,
            month DATE NOT NULL,
            monthly_max_c DOUBLE NOT NULL,
            monthly_min_c DOUBLE NOT NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO weather_monthly_extremes VALUES
            ('fort-collins-colorado-us', '2026-03-01', 15.2, 1.4),
            ('boulder-colorado-us', '2026-03-01', 13.1, 0.6),
            ('loveland-colorado-us', '2026-03-01', 14.4, 0.9)
        """
    )

    connection.execute(
        """
        CREATE TABLE dashboard_summary (
            location_key VARCHAR PRIMARY KEY,
            observation_count BIGINT NOT NULL,
            total_precipitation_mm DOUBLE NOT NULL,
            avg_high_c DOUBLE NOT NULL,
            wettest_date DATE,
            wettest_precipitation_mm DOUBLE,
            monthly_high_c DOUBLE
        )
        """
    )
    connection.execute(
        """
        INSERT INTO dashboard_summary VALUES
            ('fort-collins-colorado-us', 2, 2.3, 14.0, '2026-03-14', 2.3, 15.2),
            ('boulder-colorado-us', 2, 5.9, 11.65, '2026-03-14', 4.8, 13.1),
            ('loveland-colorado-us', 2, 3.6, 12.75, '2026-03-14', 3.4, 14.4)
        """
    )

    connection.close()


if __name__ == "__main__":
    main()
