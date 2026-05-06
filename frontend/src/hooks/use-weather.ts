import { useCallback, useEffect, useRef } from "react";
import { useWeather } from "@/lib/state";
import * as storage from "@/lib/storage";
import { getPreference, setPreference } from "@/lib/storage";
import * as openMeteo from "@/lib/open-meteo";
import type {
  LocationRecord,
  LocationSeed,
  WeatherObservation,
} from "@/lib/weather";

const DEFAULT_LOCATION: LocationSeed = {
  locationKey: "40.5852,-105.0844",
  displayName: "Fort Collins, Colorado, United States",
  name: "Fort Collins",
  admin1: "Colorado",
  country: "United States",
  latitude: 40.5852,
  longitude: -105.0844,
  timezone: "America/Denver",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function buildLocationRecord(
  seed: LocationSeed,
  observations: WeatherObservation[],
): LocationRecord {
  const first = observations[0]?.weatherDate ?? null;
  const last = observations[observations.length - 1]?.weatherDate ?? null;
  return {
    ...seed,
    observationCount: observations.length,
    firstObservationDate: first,
    latestObservationDate: last,
    lastFetchedAt: new Date().toISOString(),
  };
}

async function fetchAndStore(
  seed: LocationSeed,
): Promise<{ record: LocationRecord; observations: WeatherObservation[] }> {
  const observations = await openMeteo.fetchLocationWeather(
    seed,
    oneYearAgoISO(),
    todayISO(),
  );
  await storage.putObservations(seed.locationKey, observations);
  const record = buildLocationRecord(seed, observations);
  await storage.putLocation(record);
  return { record, observations };
}

export function useWeatherActions() {
  const { state, dispatch } = useWeather();

  const runPending = useCallback(
    async <T>(fn: () => Promise<T>, errFallback: string): Promise<T | null> => {
      dispatch({ type: "BEGIN_PENDING" });
      try {
        return await fn();
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : errFallback,
        });
        return null;
      } finally {
        dispatch({ type: "END_PENDING" });
      }
    },
    [dispatch],
  );

  const selectLocation = useCallback(
    (locationKey: string) =>
      runPending(async () => {
        const location = await storage.getLocation(locationKey);
        if (!location) {
          dispatch({ type: "SET_ERROR", error: "Location not found" });
          return;
        }
        const observations = await storage.getObservations(locationKey);
        dispatch({ type: "SELECT_LOCATION", location, observations });
        setPreference("selectedLocation", locationKey);
      }, "Failed to load location"),
    [dispatch, runPending],
  );

  const loadLocations = useCallback(
    () =>
      runPending(async () => {
        const cached = await storage.getAllLocations();
        if (cached.length === 0) {
          const { record, observations } =
            await fetchAndStore(DEFAULT_LOCATION);
          dispatch({ type: "SET_LOCATIONS", locations: [record] });
          dispatch({
            type: "SELECT_LOCATION",
            location: record,
            observations,
          });
          setPreference("selectedLocation", record.locationKey);
          return;
        }
        dispatch({ type: "SET_LOCATIONS", locations: cached });
        const savedKey = getPreference("selectedLocation");
        if (savedKey && cached.some((l) => l.locationKey === savedKey)) {
          await selectLocation(savedKey);
        }
      }, "Failed to load locations"),
    [dispatch, runPending, selectLocation],
  );

  const cacheLocation = useCallback(
    (location: LocationSeed) =>
      runPending(async () => {
        const { record, observations } = await fetchAndStore(location);
        dispatch({ type: "ADD_LOCATION", location: record });
        dispatch({
          type: "SELECT_LOCATION",
          location: record,
          observations,
        });
        setPreference("selectedLocation", record.locationKey);
        return record;
      }, "Failed to cache location"),
    [dispatch, runPending],
  );

  const refreshCurrentLocation = useCallback(
    () =>
      runPending(async () => {
        if (!state.selectedLocation) return;
        const { record, observations } = await fetchAndStore(
          state.selectedLocation,
        );
        const updated = state.locations.map((l) =>
          l.locationKey === record.locationKey ? record : l,
        );
        dispatch({ type: "SET_LOCATIONS", locations: updated });
        dispatch({
          type: "SELECT_LOCATION",
          location: record,
          observations,
        });
      }, "Failed to refresh"),
    [state.selectedLocation, state.locations, dispatch, runPending],
  );

  const searchLocations = useCallback(
    async (query: string) => {
      const remote = await openMeteo.searchRemoteLocations(query);
      const cached = new Set(state.locations.map((l) => l.locationKey));
      return remote.map((loc) => ({
        ...loc,
        isCached: cached.has(loc.locationKey),
      }));
    },
    [state.locations],
  );

  const deleteLocation = useCallback(
    async (locationKey: string) => {
      try {
        await storage.deleteLocation(locationKey);
        dispatch({ type: "REMOVE_LOCATION", locationKey });
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error:
            err instanceof Error ? err.message : "Failed to delete location",
        });
      }
    },
    [dispatch],
  );

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadLocations();
  }, [loadLocations]);

  return {
    state,
    loadLocations,
    selectLocation,
    searchLocations,
    cacheLocation,
    refreshCurrentLocation,
    deleteLocation,
  };
}
