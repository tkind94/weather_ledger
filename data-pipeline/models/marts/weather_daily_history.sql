{{ config(materialized='table') }}

with source as (
    select weather.location_key,
        locations.canonical_name,
        locations.admin1,
        locations.country,
        locations.country_code,
        weather.weather_date,
        weather.latitude,
        weather.longitude,
        weather.timezone,
        weather.max_temperature_c,
        weather.min_temperature_c,
        weather.avg_temperature_c,
        weather.precipitation_mm,
        weather.wind_speed_kph,
        weather.wind_gust_kph,
        weather.wind_direction_deg,
        weather.pressure_hpa,
        weather.source,
        weather.fetched_at
    from {{ source('weather_ledger', 'raw_weather') }} as weather
        inner join {{ source('weather_ledger', 'raw_locations') }} as locations on weather.location_key = locations.location_key
)
select *
from source
