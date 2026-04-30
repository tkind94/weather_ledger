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
  elevation?: number;
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

export function buildLocationLabel(parts: {
  name: string;
  admin1?: string | null;
  country?: string | null;
}): string {
  return [parts.name, parts.admin1, parts.country].filter(Boolean).join(", ");
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
  elevation?: number;
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
    elevation: parts.elevation,
    timezone: parts.timezone ?? "UTC",
  };
}

export type TodayVsHistorical = {
  today: WeatherObservation;
  sameDayHistory: WeatherObservation[];
  rankHigh: number;
  yearsOfRecord: number;
  avgHigh: number;
  avgLow: number;
  avgPrecip: number;
};

export type Records = {
  hi: number;
  hiDate: string;
  lo: number;
  loDate: string;
  maxPrecip: number;
  maxPrecipDate: string;
};

export type Streaks = {
  currentDry: number;
  longestDry: number;
  longestDryRange: [string, string] | null;
  longestWet: number;
  longestAboveFreeze: number;
  longestBelowFreeze: number;
};

export type Anomaly = {
  currentAvgHigh: number;
  lastYearAvgHigh: number;
  delta: number;
  label: "warmer" | "cooler";
  magnitude: number;
};

export type YoYEntry = {
  year: number;
  avgHigh: number;
  avgLow: number;
  precip: number;
};

export type TempHistogram = {
  min: number;
  max: number;
  binCount: number;
  binWidth: number;
  counts: number[];
};

export type PrecipBucket = {
  label: string;
  count: number;
};

export type RangeAgg = {
  n: number;
  avgHigh: number;
  avgLow: number;
  totalPrecip: number;
  hottest: { date: string; temp: number };
  coldest: { date: string; temp: number };
};

export function computeTodayVsHistorical(
  obs: WeatherObservation[],
): TodayVsHistorical | null {
  if (obs.length < 2) return null;
  const today = obs[obs.length - 1]!;
  const monthDay = today.weatherDate.slice(5);
  let sameDay = obs.filter(
    (o) =>
      o.weatherDate !== today.weatherDate &&
      o.weatherDate.slice(5) === monthDay,
  );
  if (sameDay.length === 0 && monthDay === "02-29") {
    sameDay = obs.filter(
      (o) =>
        o.weatherDate !== today.weatherDate &&
        o.weatherDate.slice(5) === "02-28",
    );
  }
  if (sameDay.length === 0) return null;
  const avgHigh =
    sameDay.reduce((s, o) => s + o.maxTemperature, 0) / sameDay.length;
  const avgLow =
    sameDay.reduce((s, o) => s + o.minTemperature, 0) / sameDay.length;
  const avgPrecip =
    sameDay.reduce((s, o) => s + o.precipitation, 0) / sameDay.length;
  const rankHigh =
    sameDay.filter((o) => o.maxTemperature > today.maxTemperature).length + 1;
  return {
    today,
    sameDayHistory: sameDay,
    rankHigh,
    yearsOfRecord: sameDay.length,
    avgHigh,
    avgLow,
    avgPrecip,
  };
}

export function computeRecords(obs: WeatherObservation[]): Records | null {
  if (obs.length === 0) return null;
  let hi = -Infinity,
    hiDate = "";
  let lo = Infinity,
    loDate = "";
  let maxPrecip = 0,
    maxPrecipDate = "";
  for (const o of obs) {
    if (o.maxTemperature > hi) {
      hi = o.maxTemperature;
      hiDate = o.weatherDate;
    }
    if (o.minTemperature < lo) {
      lo = o.minTemperature;
      loDate = o.weatherDate;
    }
    if (o.precipitation > maxPrecip) {
      maxPrecip = o.precipitation;
      maxPrecipDate = o.weatherDate;
    }
  }
  return { hi, hiDate, lo, loDate, maxPrecip, maxPrecipDate };
}

export function computeStreaks(obs: WeatherObservation[]): Streaks {
  let dryRun = 0,
    longestDry = 0,
    longestDryRange: [string, string] | null = null;
  let curDryStart = "";
  let wetRun = 0,
    longestWet = 0;
  let aboveFreezeRun = 0,
    longestAboveFreeze = 0;
  let belowFreezeRun = 0,
    longestBelowFreeze = 0;

  for (const o of obs) {
    if (o.precipitation < 0.1) {
      if (dryRun === 0) curDryStart = o.weatherDate;
      dryRun++;
      if (dryRun > longestDry) {
        longestDry = dryRun;
        longestDryRange = [curDryStart, o.weatherDate];
      }
    } else {
      dryRun = 0;
    }

    if (o.precipitation >= 0.1) {
      wetRun++;
      if (wetRun > longestWet) longestWet = wetRun;
    } else wetRun = 0;

    if (o.minTemperature > 0) {
      aboveFreezeRun++;
      if (aboveFreezeRun > longestAboveFreeze)
        longestAboveFreeze = aboveFreezeRun;
    } else aboveFreezeRun = 0;

    if (o.maxTemperature <= 0) {
      belowFreezeRun++;
      if (belowFreezeRun > longestBelowFreeze)
        longestBelowFreeze = belowFreezeRun;
    } else belowFreezeRun = 0;
  }

  let currentDry = 0;
  for (let i = obs.length - 1; i >= 0; i--) {
    if (obs[i]!.precipitation < 0.1) currentDry++;
    else break;
  }

  return {
    currentDry,
    longestDry,
    longestDryRange,
    longestWet,
    longestAboveFreeze,
    longestBelowFreeze,
  };
}

export function computeAnomalies(obs: WeatherObservation[]): Anomaly | null {
  if (obs.length < 14) return null;
  const last = obs[obs.length - 1]!;
  const lastDate = new Date(last.weatherDate + "T00:00:00Z");
  const sevenAgo = new Date(lastDate.getTime() - 7 * 86400000);
  const yearAgo = new Date(lastDate.getTime() - 365 * 86400000);
  const yearSevenAgo = new Date(lastDate.getTime() - (365 + 7) * 86400000);

  const recent = obs.filter(
    (o) => new Date(o.weatherDate + "T00:00:00Z") > sevenAgo,
  );
  const prevYear = obs.filter((o) => {
    const d = new Date(o.weatherDate + "T00:00:00Z");
    return d >= yearSevenAgo && d < yearAgo;
  });
  if (recent.length === 0 || prevYear.length === 0) return null;

  const currentAvgHigh =
    recent.reduce((s, o) => s + o.maxTemperature, 0) / recent.length;
  const lastYearAvgHigh =
    prevYear.reduce((s, o) => s + o.maxTemperature, 0) / prevYear.length;
  const delta = currentAvgHigh - lastYearAvgHigh;
  return {
    currentAvgHigh,
    lastYearAvgHigh,
    delta,
    label: delta >= 0 ? "warmer" : "cooler",
    magnitude: Math.abs(delta),
  };
}

export function computeYoY(obs: WeatherObservation[]): YoYEntry[] {
  if (obs.length === 0) return [];
  const last = obs[obs.length - 1]!;
  const lastDate = new Date(last.weatherDate + "T00:00:00Z");
  const yearStart = new Date(Date.UTC(lastDate.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor(
    (lastDate.getTime() - yearStart.getTime()) / 86400000,
  );

  const byYear: Record<
    number,
    { highs: number[]; lows: number[]; precip: number }
  > = {};
  for (const o of obs) {
    const d = new Date(o.weatherDate + "T00:00:00Z");
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const doy = Math.floor((d.getTime() - ys.getTime()) / 86400000);
    if (Math.abs(doy - dayOfYear) <= 3) {
      const y = d.getUTCFullYear();
      if (!byYear[y]) byYear[y] = { highs: [], lows: [], precip: 0 };
      byYear[y]!.highs.push(o.maxTemperature);
      byYear[y]!.lows.push(o.minTemperature);
      byYear[y]!.precip += o.precipitation;
    }
  }

  return Object.keys(byYear)
    .sort()
    .map((y) => {
      const e = byYear[+y]!;
      return {
        year: +y,
        avgHigh: e.highs.reduce((a, b) => a + b, 0) / e.highs.length,
        avgLow: e.lows.reduce((a, b) => a + b, 0) / e.lows.length,
        precip: e.precip,
      };
    });
}

export function computeTempHistogram(
  obs: WeatherObservation[],
  bins = 24,
): TempHistogram {
  if (obs.length === 0)
    return {
      min: 0,
      max: 0,
      binCount: bins,
      binWidth: 1,
      counts: Array(bins).fill(0),
    };
  const all = obs.map((o) => o.maxTemperature);
  const min = Math.floor(Math.min(...all));
  const max = Math.ceil(Math.max(...all));
  const binWidth = (max - min) / bins;
  const counts = Array<number>(bins).fill(0);
  for (const v of all) {
    const i = Math.min(bins - 1, Math.floor((v - min) / binWidth));
    counts[i]!++;
  }
  return { min, max, binCount: bins, binWidth, counts };
}

export function computePrecipHistogram(
  obs: WeatherObservation[],
): PrecipBucket[] {
  const buckets: [number, number, string][] = [
    [0, 0.1, "dry"],
    [0.1, 1, "<1mm"],
    [1, 5, "1–5"],
    [5, 10, "5–10"],
    [10, 25, "10–25"],
    [25, 50, "25–50"],
    [50, 999, "50+"],
  ];
  const counts = buckets.map(() => 0);
  for (const o of obs) {
    for (let i = 0; i < buckets.length; i++) {
      if (
        o.precipitation >= buckets[i]![0] &&
        o.precipitation < buckets[i]![1]
      ) {
        counts[i]!++;
        break;
      }
    }
  }
  return buckets.map((b, i) => ({ label: b[2], count: counts[i]! }));
}

export function computeCalendarYear(
  obs: WeatherObservation[],
): WeatherObservation[] {
  if (obs.length === 0) return [];
  const last = obs[obs.length - 1]!;
  const cutoff = new Date(
    new Date(last.weatherDate + "T00:00:00Z").getTime() - 364 * 86400000,
  );
  return obs.filter((o) => new Date(o.weatherDate + "T00:00:00Z") >= cutoff);
}

export function computeRangeAgg(
  obs: WeatherObservation[],
  days: number | null,
): RangeAgg | null {
  if (obs.length === 0) return null;
  let slice: WeatherObservation[];
  if (days === null) {
    slice = obs;
  } else {
    const last = obs[obs.length - 1]!;
    const cutoff = new Date(
      new Date(last.weatherDate + "T00:00:00Z").getTime() - days * 86400000,
    );
    slice = obs.filter((o) => new Date(o.weatherDate + "T00:00:00Z") > cutoff);
  }
  if (slice.length === 0) return null;

  let sumH = 0,
    sumL = 0,
    sumP = 0;
  let hi = -Infinity,
    hiDate = "";
  let lo = Infinity,
    loDate = "";
  for (const o of slice) {
    sumH += o.maxTemperature;
    sumL += o.minTemperature;
    sumP += o.precipitation;
    if (o.maxTemperature > hi) {
      hi = o.maxTemperature;
      hiDate = o.weatherDate;
    }
    if (o.minTemperature < lo) {
      lo = o.minTemperature;
      loDate = o.weatherDate;
    }
  }
  return {
    n: slice.length,
    avgHigh: sumH / slice.length,
    avgLow: sumL / slice.length,
    totalPrecip: sumP,
    hottest: { date: hiDate, temp: hi },
    coldest: { date: loDate, temp: lo },
  };
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
