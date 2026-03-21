{{ config(materialized='incremental') }}

with source as (
  select
    cast(weather_date as date) as weather_date,
    latitude,
    longitude,
    cast(max_temperature_c as double) as source_max_temperature_c,
    cast(min_temperature_c as double) as source_min_temperature_c
  from {{ ref('stg_raw_weather') }}
)

select
  date_trunc('month', weather_date)::date as month,
  latitude,
  longitude,
  max(source_max_temperature_c) as monthly_max_c,
  min(source_min_temperature_c) as monthly_min_c
from source
{% if is_incremental() %}
where weather_date > (
  select coalesce(max(month), '1970-01-01') from {{ this }}
)
{% endif %}
group by 1, 2, 3
