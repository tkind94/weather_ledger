import {
  canonicalizeLocationSeed,
  type LocationSeed,
  type WeatherObservation,
} from "./weather";

type GeocodingResult = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type ArchiveDaily = {
  time: string[];
  temperature_2m_max: Array<number | null>;
  temperature_2m_min: Array<number | null>;
  precipitation_sum: Array<number | null>;
};

type ArchiveResponse = {
  daily?: ArchiveDaily;
};

export function observationsFromArchiveDaily(
  daily: ArchiveDaily,
): WeatherObservation[] {
  const results: WeatherObservation[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    const maxTemp = daily.temperature_2m_max[i];
    const minTemp = daily.temperature_2m_min[i];
    const precip = daily.precipitation_sum[i];
    if (maxTemp == null || minTemp == null || precip == null) continue;
    results.push({
      weatherDate: daily.time[i]!,
      maxTemperature: maxTemp,
      minTemperature: minTemp,
      precipitation: precip,
    });
  }
  return results;
}

export function observationsFromArchiveResponse(
  payload: ArchiveResponse,
): WeatherObservation[] {
  if (!payload.daily) return [];
  return observationsFromArchiveDaily(payload.daily);
}

export async function searchRemoteLocations(
  query: string,
): Promise<LocationSeed[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding request failed: ${response.status}`);
  }

  const data: GeocodingResponse = await response.json();
  if (!data.results) return [];

  return data.results.map((result) =>
    canonicalizeLocationSeed({
      name: result.name,
      admin1: result.admin1,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    }),
  );
}

export async function fetchLocationWeather(
  location: LocationSeed,
  startDate: string,
  endDate: string,
): Promise<WeatherObservation[]> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  url.searchParams.set("timezone", location.timezone);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Archive request failed: ${response.status}`);
  }

  const data: ArchiveResponse = await response.json();
  return observationsFromArchiveResponse(data);
}
