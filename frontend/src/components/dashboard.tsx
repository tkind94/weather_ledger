import { useWeatherActions } from "@/hooks/use-weather";
import { LocationSearch } from "@/components/location-search";
import { SummaryCards } from "@/components/summary-cards";
import { WeatherChart } from "@/components/weather-chart";
import { ObservationTable } from "@/components/observation-table";
import { Skeleton } from "@/components/ui/skeleton";
import { coordinateLabel, formatTimestamp } from "@/lib/weather";

export function Dashboard() {
  const {
    state,
    selectLocation,
    searchLocations,
    cacheLocation,
    refreshCurrentLocation,
    deleteLocation,
  } = useWeatherActions();

  const { selectedLocation, observations, summary, locations, loading, error } =
    state;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight">
            Weather Ledger
          </h1>
          <p className="mt-2 text-muted-foreground">
            Historical weather data, cached locally.
            {locations.length > 0 && (
              <span className="ml-1">
                {locations.length} location{locations.length !== 1 ? "s" : ""}{" "}
                cached.
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-72">
            <LocationSearch
              locations={locations}
              selectedLocationKey={selectedLocation?.locationKey ?? null}
              onSearch={searchLocations}
              onSelect={selectLocation}
              onCache={cacheLocation}
              onDelete={deleteLocation}
              onRefresh={refreshCurrentLocation}
              loading={loading}
            />
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {error && (
              <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!selectedLocation ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-lg font-serif text-muted-foreground">
                  Select a location to view its weather history
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Search for a city above, or use the default Fort Collins data.
                </p>
              </div>
            ) : loading && observations.length === 0 ? (
              <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
                <Skeleton className="h-[380px] rounded-2xl" />
                <Skeleton className="h-[480px] rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Location header */}
                <div>
                  <h2 className="font-serif text-2xl font-bold">
                    {selectedLocation.displayName}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      {coordinateLabel(
                        selectedLocation.latitude,
                        selectedLocation.longitude,
                      )}
                    </span>
                    <span>{selectedLocation.timezone}</span>
                    {selectedLocation.lastFetchedAt && (
                      <span>
                        Updated{" "}
                        {formatTimestamp(selectedLocation.lastFetchedAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Summary cards */}
                {summary && <SummaryCards summary={summary} />}

                {/* Chart */}
                <WeatherChart observations={observations} />

                {/* Table */}
                <ObservationTable observations={observations} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
