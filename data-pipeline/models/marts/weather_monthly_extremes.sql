{{ config(
    materialized='incremental',
    unique_key=['month', 'latitude', 'longitude']
) }}

with source as (
  select
    weather_date,
    latitude,
    longitude,
    max_temperature_c,
    min_temperature_c
  from {{ source('weather_ledger', 'raw_weather') }}
)

select
  date_trunc('month', weather_date)::date as month,
  latitude,
  longitude,
  max(max_temperature_c) as monthly_max_c,
  min(min_temperature_c) as monthly_min_c
from source
{% if is_incremental() %}
where date_trunc('month', weather_date)::date >= (
  select coalesce(max(month), '1970-01-01') from {{ this }}
)
{% endif %}
group by month, latitude, longitude
