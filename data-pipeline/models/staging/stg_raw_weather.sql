select
  cast(weather_date as date) as weather_date,
  cast(latitude as double) as latitude,
  cast(longitude as double) as longitude,
  cast(timezone as varchar) as timezone,
  cast(max_temperature_c as double) as max_temperature_c,
  cast(precipitation_mm as double) as precipitation_mm,
  cast(source as varchar) as source,
  cast(fetched_at as timestamp) as fetched_at
from {{ source('weather_ledger', 'raw_weather') }}