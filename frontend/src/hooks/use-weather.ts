import { useCallback, useEffect, useRef } from "react";
import { useWeather } from "@/lib/state";
import * as storage from "@/lib/storage";
import { getPreference, setPreference } from "@/lib/storage";
import * as openMeteo from "@/lib/open-meteo";
import {
  summarizeObservations,
  type LocationRecord,
  type LocationSeed,
  type WeatherObservation,
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

  const selectLocation = useCallback(
    async (locationKey: string) => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const location = await storage.getLocation(locationKey);
        if (!location) {
          dispatch({ type: "SET_ERROR", error: "Location not found" });
          return;
        }
        const observations = await storage.getObservations(locationKey);
        const summary = summarizeObservations(observations);
        dispatch({ type: "SELECT_LOCATION", location, observations, summary });
        setPreference("selectedLocation", locationKey);
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Failed to load location",
        });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [dispatch],
  );

  const loadLocations = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const cached = await storage.getAllLocations();
      if (cached.length === 0) {
        const { record, observations } = await fetchAndStore(DEFAULT_LOCATION);
        const summary = summarizeObservations(observations);
        dispatch({ type: "SET_LOCATIONS", locations: [record] });
        dispatch({
          type: "SELECT_LOCATION",
          location: record,
          observations,
          summary,
        });
        setPreference("selectedLocation", record.locationKey);
        return;
      }
      dispatch({ type: "SET_LOCATIONS", locations: cached });
      const savedKey = getPreference("selectedLocation");
      if (savedKey && cached.some((l) => l.locationKey === savedKey)) {
        await selectLocation(savedKey);
      }
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to load locations",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [dispatch, selectLocation]);

  const cacheLocation = useCallback(
    async (location: LocationSeed) => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const { record, observations } = await fetchAndStore(location);
        const summary = summarizeObservations(observations);
        dispatch({ type: "ADD_LOCATION", location: record });
        dispatch({
          type: "SELECT_LOCATION",
          location: record,
          observations,
          summary,
        });
        setPreference("selectedLocation", record.locationKey);
        return record;
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error:
            err instanceof Error ? err.message : "Failed to cache location",
        });
        throw err;
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [dispatch],
  );

  const refreshCurrentLocation = useCallback(async () => {
    if (!state.selectedLocation) return;
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const { record, observations } = await fetchAndStore(
        state.selectedLocation,
      );
      const summary = summarizeObservations(observations);
      const updated = state.locations.map((l) =>
        l.locationKey === record.locationKey ? record : l,
      );
      dispatch({ type: "SET_LOCATIONS", locations: updated });
      dispatch({
        type: "SELECT_LOCATION",
        location: record,
        observations,
        summary,
      });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to refresh",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, [state.selectedLocation, state.locations, dispatch]);

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
