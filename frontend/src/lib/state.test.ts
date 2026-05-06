import { describe, expect, it } from "vitest";
import { initialState, weatherReducer } from "./weather-reducer";
import type { LocationRecord, WeatherObservation } from "./weather";

const makeLocation = (key: string): LocationRecord => ({
  locationKey: key,
  displayName: `Location ${key}`,
  name: key,
  admin1: null,
  country: null,
  latitude: 0,
  longitude: 0,
  timezone: "UTC",
  observationCount: 0,
  firstObservationDate: null,
  latestObservationDate: null,
  lastFetchedAt: null,
});

const makeObs = (date: string): WeatherObservation => ({
  weatherDate: date,
  maxTemperature: 20,
  minTemperature: 10,
  precipitation: 0,
});

describe("weatherReducer", () => {
  it("BEGIN_PENDING increments and END_PENDING decrements (clamped at 0)", () => {
    let s = weatherReducer(initialState, { type: "BEGIN_PENDING" });
    expect(s.pending).toBe(1);
    s = weatherReducer(s, { type: "BEGIN_PENDING" });
    expect(s.pending).toBe(2);
    s = weatherReducer(s, { type: "END_PENDING" });
    expect(s.pending).toBe(1);
    s = weatherReducer(s, { type: "END_PENDING" });
    s = weatherReducer(s, { type: "END_PENDING" });
    expect(s.pending).toBe(0);
  });

  it("SELECT_LOCATION clears any prior error", () => {
    const withErr = weatherReducer(initialState, {
      type: "SET_ERROR",
      error: "boom",
    });
    expect(withErr.error).toBe("boom");
    const next = weatherReducer(withErr, {
      type: "SELECT_LOCATION",
      location: makeLocation("a"),
      observations: [makeObs("2024-01-01")],
    });
    expect(next.error).toBeNull();
    expect(next.selectedLocation?.locationKey).toBe("a");
    expect(next.observations).toHaveLength(1);
  });

  it("REMOVE_LOCATION clears selection iff the removed key was selected", () => {
    const seeded = weatherReducer(initialState, {
      type: "SET_LOCATIONS",
      locations: [makeLocation("a"), makeLocation("b")],
    });
    const selected = weatherReducer(seeded, {
      type: "SELECT_LOCATION",
      location: makeLocation("a"),
      observations: [makeObs("2024-01-01")],
    });

    const removeOther = weatherReducer(selected, {
      type: "REMOVE_LOCATION",
      locationKey: "b",
    });
    expect(removeOther.selectedLocation?.locationKey).toBe("a");
    expect(removeOther.observations).toHaveLength(1);
    expect(removeOther.locations.map((l) => l.locationKey)).toEqual(["a"]);

    const removeSelected = weatherReducer(selected, {
      type: "REMOVE_LOCATION",
      locationKey: "a",
    });
    expect(removeSelected.selectedLocation).toBeNull();
    expect(removeSelected.observations).toEqual([]);
  });

  it("ADD_LOCATION appends without disturbing selection", () => {
    const next = weatherReducer(
      weatherReducer(initialState, {
        type: "SELECT_LOCATION",
        location: makeLocation("a"),
        observations: [],
      }),
      { type: "ADD_LOCATION", location: makeLocation("b") },
    );
    expect(next.locations.map((l) => l.locationKey)).toEqual(["b"]);
    expect(next.selectedLocation?.locationKey).toBe("a");
  });
});
