export type WeatherObservation = {
  weatherDate: string;
  maxTemperature: number;
  minTemperature: number;
  precipitation: number;
};

export type LocationSeed = {
  locationKey: string;
  displayName: string;
  name: string;
  admin1: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type LocationCandidate = LocationSeed & {
  isCached: boolean;
};

export type LocationRecord = LocationSeed & {
  observationCount: number;
  firstObservationDate: string | null;
  latestObservationDate: string | null;
  lastFetchedAt: string | null;
};

export type DashboardSummary = {
  observationCount: number;
  avgHigh: number | null;
  avgLow: number | null;
  totalPrecipitation: number;
  hottestDate: string | null;
  hottestTemperature: number | null;
  wettestDate: string | null;
  wettestPrecipitation: number | null;
};

export type DashboardData = {
  cachedLocations: LocationRecord[];
  selectedLocation: LocationRecord | null;
  observations: WeatherObservation[];
  summary: DashboardSummary | null;
};

export function buildLocationLabel(parts: {
  name: string;
  admin1?: string | null;
  country?: string | null;
}): string {
  return [parts.name, parts.admin1, parts.country].filter(Boolean).join(", ");
}

export function buildLocationKey(parts: {
  name: string;
  admin1?: string | null;
  country?: string | null;
}): string {
  const slug = [parts.name, parts.admin1, parts.country]
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug;
}

export function coordinateCacheKey(
  latitude: number,
  longitude: number,
): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export function canonicalizeLocationSeed(parts: {
  name: string;
  admin1?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string;
}): LocationSeed {
  return {
    locationKey: coordinateCacheKey(parts.latitude, parts.longitude),
    displayName: buildLocationLabel(parts),
    name: parts.name,
    admin1: parts.admin1 ?? null,
    country: parts.country ?? null,
    latitude: parts.latitude,
    longitude: parts.longitude,
    timezone: parts.timezone ?? "UTC",
  };
}

export function coordinateLabel(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? "N" : "S";
  const lonDir = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(3)}\u00B0 ${latDir}, ${Math.abs(longitude).toFixed(3)}\u00B0 ${lonDir}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatTimestamp(value: string): string {
  return timestampFormatter.format(new Date(value));
}

export function formatTemperature(value: number): string {
  return `${value.toFixed(1)}\u00B0C`;
}

export function formatPrecipitation(value: number): string {
  return `${value.toFixed(1)} mm`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} \u2013 ${formatDate(endDate)}`;
}

export function summarizeObservations(
  observations: WeatherObservation[],
): DashboardSummary {
  if (observations.length === 0) {
    return {
      observationCount: 0,
      avgHigh: null,
      avgLow: null,
      totalPrecipitation: 0,
      hottestDate: null,
      hottestTemperature: null,
      wettestDate: null,
      wettestPrecipitation: null,
    };
  }

  let sumHigh = 0;
  let sumLow = 0;
  let totalPrecip = 0;
  let hottestDate: string | null = null;
  let hottestTemp: number | null = null;
  let wettestDate: string | null = null;
  let wettestPrecip: number | null = null;

  for (const obs of observations) {
    sumHigh += obs.maxTemperature;
    sumLow += obs.minTemperature;
    totalPrecip += obs.precipitation;

    if (hottestTemp === null || obs.maxTemperature > hottestTemp) {
      hottestTemp = obs.maxTemperature;
      hottestDate = obs.weatherDate;
    }

    if (wettestPrecip === null || obs.precipitation > wettestPrecip) {
      wettestPrecip = obs.precipitation;
      wettestDate = obs.weatherDate;
    }
  }

  return {
    observationCount: observations.length,
    avgHigh: sumHigh / observations.length,
    avgLow: sumLow / observations.length,
    totalPrecipitation: totalPrecip,
    hottestDate,
    hottestTemperature: hottestTemp,
    wettestDate,
    wettestPrecipitation: wettestPrecip,
  };
}
