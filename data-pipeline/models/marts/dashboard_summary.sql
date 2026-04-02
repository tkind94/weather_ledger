{{ config(materialized='table') }}

with agg as (
    select
        location_key,
        count(*) as observation_count,
        coalesce(sum(precipitation_mm), 0.0) as total_precipitation_mm,
        coalesce(avg(max_temperature_c), 0.0) as avg_high_c
    from {{ ref('weather_daily_history') }}
    group by location_key
),

wettest as (
    select
        location_key,
        weather_date,
        precipitation_mm,
        row_number() over (
            partition by location_key
            order by precipitation_mm desc, weather_date desc
        ) as row_number
    from {{ ref('weather_daily_history') }}
),

latest_monthly as (
    select
        location_key,
        monthly_max_c,
        row_number() over (
            partition by location_key
            order by month desc
        ) as row_number
    from {{ ref('weather_monthly_extremes') }}
)

select
    agg.location_key,
    agg.observation_count,
    agg.total_precipitation_mm,
    agg.avg_high_c,
    wettest.weather_date as wettest_date,
    wettest.precipitation_mm as wettest_precipitation_mm,
    latest_monthly.monthly_max_c as monthly_high_c
from agg
left join wettest
    on agg.location_key = wettest.location_key
    and wettest.row_number = 1
left join latest_monthly
    on agg.location_key = latest_monthly.location_key
    and latest_monthly.row_number = 1
