select
  weather_date,
  latitude,
  longitude,
  timezone,
  max_temperature_c,
  precipitation_mm,
  source,
  fetched_at
from {{ ref('stg_raw_weather') }}
order by weather_date