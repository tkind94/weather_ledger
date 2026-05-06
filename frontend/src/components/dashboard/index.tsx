import { useWeatherActions } from "@/hooks/use-weather";
import { usePreference } from "@/hooks/use-preference";
import { Mono, Placeholder } from "./primitives";
import { AggregatesSection } from "./aggregates";
import { AnomalyBanner } from "./anomaly";
import { AppHeader } from "./header";
import { CalendarSection } from "./calendar";
import { ChartSection } from "./chart-section";
import { DashboardProvider } from "./context";
import { DistributionsSection } from "./distributions";
import { HeroSection } from "./hero";
import { RecentAndStreaks } from "./recent-streaks";
import { RecordsSection } from "./records";
import { SectionBoundary } from "./section-boundary";
import { StationsRail } from "./stations-rail";
import { YoYSection } from "./yoy";
import type { Range, Units } from "./format";

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
                <ChartSection />
              </SectionBoundary>
              <SectionBoundary label="§04–05">
                <RecentAndStreaks />
              </SectionBoundary>
              <SectionBoundary label="§06">
                <CalendarSection />
              </SectionBoundary>
              <div className="grid grid-cols-2 gap-3.5">
                <SectionBoundary label="§08">
                  <YoYSection />
                </SectionBoundary>
                <SectionBoundary label="§07">
                  <RecordsSection />
                </SectionBoundary>
              </div>
              <SectionBoundary label="§09">
                <DistributionsSection />
              </SectionBoundary>
            </>
          )}
        </div>

        <Footer count={observations.length} />
      </div>
    </DashboardProvider>
  );
}
