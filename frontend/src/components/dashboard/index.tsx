import { useMemo, useState } from "react";
import { useWeatherActions } from "@/hooks/use-weather";
import { getPreference, setPreference } from "@/lib/storage";
import {
  computeAnomalies,
  computeCalendarYear,
  computePrecipHistogram,
  computeRangeAgg,
  computeRecords,
  computeStreaks,
  computeTempHistogram,
  computeTodayVsHistorical,
  computeYoY,
} from "@/lib/weather";
import { Mono, Placeholder } from "./primitives";
import { AggregatesSection } from "./aggregates";
import { AnomalyBanner } from "./anomaly";
import { AppHeader } from "./header";
import { CalendarSection } from "./calendar";
import { ChartSection } from "./chart-section";
import { DistributionsSection } from "./distributions";
import { HeroSection } from "./hero";
import { RecentAndStreaks } from "./recent-streaks";
import { RecordsSection } from "./records";
import { StationsRail } from "./stations-rail";
import { YoYSection } from "./yoy";
import { RANGE_DAYS, type Range, type Units } from "./format";

function readPref<T extends string>(
  key: "units" | "range",
  fallback: T,
  allowed: readonly T[],
): T {
  const raw = getPreference(key);
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

const UNITS_VALUES = ["metric", "imperial"] as const;
const RANGE_VALUES = ["7d", "30d", "1y", "all"] as const;

function ErrorBanner({
  message,
  onRetry,
  loading,
}: {
  message: string;
  onRetry: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-hot bg-hot/[0.07] px-3.5 py-2">
      <Mono className="text-[11px] text-hot">{message}</Mono>
      <button
        onClick={onRetry}
        disabled={loading}
        className="cursor-pointer border-none bg-ink px-2.5 py-1 font-mono text-[10px] text-paper disabled:cursor-wait disabled:opacity-60"
      >
        Retry
      </button>
    </div>
  );
}

export function Dashboard() {
  const {
    state,
    selectLocation,
    searchLocations,
    cacheLocation,
    refreshCurrentLocation,
    deleteLocation,
  } = useWeatherActions();

  const { selectedLocation, observations, locations, loading, error } = state;

  const [units, setUnitsState] = useState<Units>(() =>
    readPref<Units>("units", "metric", UNITS_VALUES),
  );
  const [range, setRangeState] = useState<Range>(() =>
    readPref<Range>("range", "30d", RANGE_VALUES),
  );

  const setUnits = (u: Units) => {
    setUnitsState(u);
    setPreference("units", u);
  };
  const setRange = (r: Range) => {
    setRangeState(r);
    setPreference("range", r);
  };

  const todayVs = useMemo(
    () => computeTodayVsHistorical(observations),
    [observations],
  );
  const records = useMemo(() => computeRecords(observations), [observations]);
  const streaks = useMemo(() => computeStreaks(observations), [observations]);
  const anomaly = useMemo(() => computeAnomalies(observations), [observations]);
  const yoy = useMemo(() => computeYoY(observations), [observations]);
  const tempHist = useMemo(
    () => computeTempHistogram(observations),
    [observations],
  );
  const precipHist = useMemo(
    () => computePrecipHistogram(observations, units),
    [observations, units],
  );
  const calYear = useMemo(
    () => computeCalendarYear(observations),
    [observations],
  );
  const rangeAgg = useMemo(
    () => computeRangeAgg(observations, RANGE_DAYS[range]),
    [observations, range],
  );

  const hasData = observations.length > 0;
  const gridBg = `repeating-linear-gradient(0deg, hsl(var(--faint) / 0.125) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, hsl(var(--faint) / 0.125) 0 1px, transparent 1px 24px)`;

  return (
    <div
      className="min-h-screen bg-paper font-display text-ink"
      style={{ backgroundImage: gridBg }}
    >
      <AppHeader
        units={units}
        setUnits={setUnits}
        range={range}
        setRange={setRange}
        location={selectedLocation}
      />

      <div className="mx-auto flex max-w-[1440px] flex-col gap-3.5 p-4">
        <StationsRail
          locations={locations}
          selectedKey={selectedLocation?.locationKey ?? null}
          onSelect={selectLocation}
          onSearch={searchLocations}
          onCache={cacheLocation}
          onDelete={deleteLocation}
          onRefresh={refreshCurrentLocation}
          loading={loading}
        />

        {error && (
          <ErrorBanner
            message={error}
            onRetry={refreshCurrentLocation}
            loading={loading}
          />
        )}

        {!selectedLocation && !loading && (
          <Placeholder
            dashed
            message="Search for a station above to load weather data."
          />
        )}

        {loading && !hasData && <Placeholder message="Loading station data…" />}

        {hasData && (
          <>
            {anomaly && <AnomalyBanner anomaly={anomaly} units={units} />}
            {todayVs && <HeroSection todayVs={todayVs} units={units} />}
            {rangeAgg && (
              <AggregatesSection agg={rangeAgg} units={units} range={range} />
            )}
            <ChartSection
              observations={observations}
              units={units}
              range={range}
            />
            <RecentAndStreaks
              observations={observations}
              streaks={streaks}
              units={units}
            />
            <CalendarSection calYear={calYear} />
            <div className="grid grid-cols-2 gap-3.5">
              <YoYSection yoy={yoy} units={units} />
              {records && <RecordsSection records={records} units={units} />}
            </div>
            <DistributionsSection
              tempHist={tempHist}
              precipHist={precipHist}
              units={units}
            />
          </>
        )}
      </div>

      <footer className="mt-4 flex justify-between border-t-2 border-ink bg-paper px-[18px] py-2.5">
        <Mono
          className="text-[9px] text-ink-soft"
          style={{ letterSpacing: "0.18em" }}
        >
          WEATHER LEDGER · DATA · OPEN-METEO.COM · OPEN-METEO GEOCODING API
        </Mono>
        <Mono
          className="text-[9px] text-ink-soft"
          style={{ letterSpacing: "0.1em" }}
        >
          {observations.length > 0
            ? `${observations.length} OBSERVATIONS ON FILE`
            : "NO DATA"}
        </Mono>
      </footer>
    </div>
  );
}
