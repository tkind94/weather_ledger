{{ config(materialized='table') }}

with observation_bounds as (
    select location_key,
        count(*) as observation_count,
        min(weather_date) as first_observation_date,
        max(weather_date) as latest_observation_date,
        max(fetched_at) as last_fetched_at
    from {{ ref('weather_daily_history') }}
    group by location_key
)
select locations.location_key,
    locations.canonical_name,
    locations.admin1,
    locations.country,
    locations.country_code,
    locations.latitude,
    locations.longitude,
    locations.timezone,
    coalesce(bounds.observation_count, 0) as observation_count,
    bounds.first_observation_date,
    bounds.latest_observation_date,
    bounds.last_fetched_at
from {{ source('weather_ledger', 'raw_locations') }} as locations
    left join observation_bounds as bounds on locations.location_key = bounds.location_key
