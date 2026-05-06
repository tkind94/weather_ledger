import { lazy, Suspense } from "react";
import { useWeatherActions } from "@/hooks/use-weather";
import { usePreference } from "@/hooks/use-preference";
import { Frame, Mono, Placeholder } from "./primitives";
import { AggregatesSection } from "./aggregates";
import { AnomalyBanner } from "./anomaly";
import { AppHeader } from "./header";
import { DashboardProvider } from "./context";
import { HeroSection } from "./hero";
import { RecentAndStreaks } from "./recent-streaks";
import { RecordsSection } from "./records";
import { SectionBoundary } from "./section-boundary";
import { StationsRail } from "./stations-rail";
import type { Range, Units } from "./format";

// ECharts is ~1MB. Defer it past first paint so the header, station rail,
// hero, and §02 summary render immediately.
const ChartSection = lazy(() => import("./chart-section"));
const CalendarSection = lazy(() => import("./calendar"));
const YoYSection = lazy(() => import("./yoy"));
const DistributionsSection = lazy(() => import("./distributions"));

function ChartFallback({ label }: { label: string }) {
  return (
    <Frame label={label}>
      <div className="flex h-[160px] items-center justify-center">
        <Mono className="text-[11px] text-ink-soft">loading chart…</Mono>
      </div>
    </Frame>
  );
}

const UNITS_VALUES = ["metric", "imperial"] as const;
const RANGE_VALUES = ["7d", "30d", "1y", "all"] as const;

const GRID_BG =
  "repeating-linear-gradient(0deg, hsl(var(--faint) / 0.125) 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, hsl(var(--faint) / 0.125) 0 1px, transparent 1px 24px)";

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

function Footer({ count }: { count: number }) {
  return (
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
        {count > 0 ? `${count} OBSERVATIONS ON FILE` : "NO DATA"}
      </Mono>
    </footer>
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

  const { selectedLocation, observations, locations, pending, error } = state;
  const loading = pending > 0;
  const hasData = observations.length > 0;

  const [units, setUnits] = usePreference<Units>(
    "units",
    "metric",
    UNITS_VALUES,
  );
  const [range, setRange] = usePreference<Range>("range", "30d", RANGE_VALUES);

  return (
    <DashboardProvider units={units} range={range} observations={observations}>
      <div
        className="min-h-screen bg-paper font-display text-ink"
        style={{ backgroundImage: GRID_BG }}
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

          {loading && !hasData && (
            <Placeholder message="Loading station data…" />
          )}

          {hasData && (
            <>
              <SectionBoundary label="Anomaly">
                <AnomalyBanner />
              </SectionBoundary>
              <SectionBoundary label="§01">
                <HeroSection />
              </SectionBoundary>
              <SectionBoundary label="§02">
                <AggregatesSection />
              </SectionBoundary>
              <SectionBoundary label="§03">
                <Suspense fallback={<ChartFallback label="§03 Trends" />}>
                  <ChartSection />
                </Suspense>
              </SectionBoundary>
              <SectionBoundary label="§04–05">
                <RecentAndStreaks />
              </SectionBoundary>
              <SectionBoundary label="§06">
                <Suspense fallback={<ChartFallback label="§06 Calendar" />}>
                  <CalendarSection />
                </Suspense>
              </SectionBoundary>
              <div className="grid grid-cols-2 gap-3.5">
                <SectionBoundary label="§08">
                  <Suspense fallback={<ChartFallback label="§08 YoY" />}>
                    <YoYSection />
                  </Suspense>
                </SectionBoundary>
                <SectionBoundary label="§07">
                  <RecordsSection />
                </SectionBoundary>
              </div>
              <SectionBoundary label="§09">
                <Suspense
                  fallback={<ChartFallback label="§09 Distributions" />}
                >
                  <DistributionsSection />
                </Suspense>
              </SectionBoundary>
            </>
          )}
        </div>

        <Footer count={observations.length} />
      </div>
    </DashboardProvider>
  );
}
