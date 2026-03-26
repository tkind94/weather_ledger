{{ config(materialized='table') }}

with agg as (
    select
        count(*) as observation_count,
        coalesce(sum(precipitation_mm), 0.0) as total_precipitation_mm,
        coalesce(avg(max_temperature_c), 0.0) as avg_high_c
    from {{ source('weather_ledger', 'raw_weather') }}
),

wettest as (
    select weather_date, precipitation_mm
    from {{ source('weather_ledger', 'raw_weather') }}
    order by precipitation_mm desc, weather_date desc
    limit 1
),

latest_monthly as (
    select monthly_max_c
    from {{ ref('weather_monthly_extremes') }}
    order by month desc
    limit 1
)

select
    agg.observation_count,
    agg.total_precipitation_mm,
    agg.avg_high_c,
    wettest.weather_date as wettest_date,
    wettest.precipitation_mm as wettest_precipitation_mm,
    latest_monthly.monthly_max_c as monthly_high_c
from agg
left join wettest on true
left join latest_monthly on true
