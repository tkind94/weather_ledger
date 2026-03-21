select
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
from {{ ref('stg_raw_weather') }}
order by weather_date
