select
  cast(weather_date as date) as weather_date,
  cast(latitude as double) as latitude,
  cast(longitude as double) as longitude,
  cast(timezone as varchar) as timezone,
  cast(max_temperature_c as double) as max_temperature_c,
  cast(min_temperature_c as double) as min_temperature_c,
  cast(avg_temperature_c as double) as avg_temperature_c,
  cast(precipitation_mm as double) as precipitation_mm,
  cast(wind_speed_kph as double) as wind_speed_kph,
  cast(wind_gust_kph as double) as wind_gust_kph,
  cast(wind_direction_deg as double) as wind_direction_deg,
  cast(pressure_hpa as double) as pressure_hpa,
  cast(source as varchar) as source,
  cast(fetched_at as timestamp) as fetched_at
from {{ source('weather_ledger', 'raw_weather') }}
