{{ config(materialized='table') }}

with source as (
    select
        location_key,
        weather_date,
        max_temperature_c,
        min_temperature_c
    from {{ ref('weather_daily_history') }}
)

select
    location_key,
    date_trunc('month', weather_date)::date as month,
    max(max_temperature_c) as monthly_max_c,
    min(min_temperature_c) as monthly_min_c
from source
group by location_key, month
