import { useCallback, useEffect, useRef } from "react";
import { useWeather } from "@/lib/state";
import * as storage from "@/lib/storage";
import { getPreference } from "@/lib/storage";
import * as openMeteo from "@/lib/open-meteo";
import { summarizeObservations, type LocationSeed } from "@/lib/weather";

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
      const locations = await storage.getAllLocations();
      if (locations.length === 0) {
        // Seed default location
        const observations = await openMeteo.fetchLocationWeather(
          DEFAULT_LOCATION,
          oneYearAgoISO(),
          todayISO(),
        );
        await storage.putObservations(
          DEFAULT_LOCATION.locationKey,
          observations,
        );
        const summary = summarizeObservations(observations);
        const record = {
          ...DEFAULT_LOCATION,
          observationCount: observations.length,
          firstObservationDate:
            observations.length > 0 ? observations[0]!.weatherDate : null,
          latestObservationDate:
            observations.length > 0
              ? observations[observations.length - 1]!.weatherDate
              : null,
          lastFetchedAt: new Date().toISOString(),
        };
        await storage.putLocation(record);
        dispatch({ type: "SET_LOCATIONS", locations: [record] });
        dispatch({
          type: "SELECT_LOCATION",
          location: record,
          observations,
          summary,
        });
      } else {
        dispatch({ type: "SET_LOCATIONS", locations });
        // Restore last selected location from persisted preference
        const savedKey = getPreference("selectedLocation");
        if (savedKey && locations.some((l) => l.locationKey === savedKey)) {
          await selectLocation(savedKey);
        }
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

  const searchLocations = useCallback(
    async (query: string) => {
      const remoteResults = await openMeteo.searchRemoteLocations(query);
      const cachedKeys = new Set(state.locations.map((l) => l.locationKey));
      return remoteResults.map((loc) => ({
        ...loc,
        isCached: cachedKeys.has(loc.locationKey),
      }));
    },
    [state.locations],
  );

  const cacheLocation = useCallback(
    async (location: LocationSeed) => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const observations = await openMeteo.fetchLocationWeather(
          location,
          oneYearAgoISO(),
          todayISO(),
        );
        await storage.putObservations(location.locationKey, observations);
        const summary = summarizeObservations(observations);
        const record = {
          ...location,
          observationCount: observations.length,
          firstObservationDate:
            observations.length > 0 ? observations[0]!.weatherDate : null,
          latestObservationDate:
            observations.length > 0
              ? observations[observations.length - 1]!.weatherDate
              : null,
          lastFetchedAt: new Date().toISOString(),
        };
        await storage.putLocation(record);
        dispatch({ type: "ADD_LOCATION", location: record });
        dispatch({
          type: "SELECT_LOCATION",
          location: record,
          observations,
          summary,
        });
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
      const loc = state.selectedLocation;
      const observations = await openMeteo.fetchLocationWeather(
        loc,
        oneYearAgoISO(),
        todayISO(),
      );
      await storage.putObservations(loc.locationKey, observations);
      const summary = summarizeObservations(observations);
      const record = {
        ...loc,
        observationCount: observations.length,
        firstObservationDate:
          observations.length > 0 ? observations[0]!.weatherDate : null,
        latestObservationDate:
          observations.length > 0
            ? observations[observations.length - 1]!.weatherDate
            : null,
        lastFetchedAt: new Date().toISOString(),
      };
      await storage.putLocation(record);
      // Update the location in the list
      const updatedLocations = state.locations.map((l) =>
        l.locationKey === record.locationKey ? record : l,
      );
      dispatch({ type: "SET_LOCATIONS", locations: updatedLocations });
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
