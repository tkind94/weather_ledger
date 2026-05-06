import { describe, it, expect } from "vitest";
import {
  buildLocationLabel,
  coordinateCacheKey,
  canonicalizeLocationSeed,
  computeTodayVsHistorical,
  type WeatherObservation,
} from "./weather";

describe("buildLocationLabel", () => {
  it("joins name, admin1, and country", () => {
    expect(
      buildLocationLabel({
        name: "Paris",
        admin1: "Île-de-France",
        country: "France",
      }),
    ).toBe("Paris, Île-de-France, France");
  });

  it("omits null/undefined parts", () => {
    expect(buildLocationLabel({ name: "Paris", country: "France" })).toBe(
      "Paris, France",
    );
  });

  it("returns just name when others are null", () => {
    expect(buildLocationLabel({ name: "Paris" })).toBe("Paris");
  });
});

describe("coordinateCacheKey", () => {
  it("formats to 4 decimal places", () => {
    expect(coordinateCacheKey(40.5853, -105.0844)).toBe("40.5853,-105.0844");
  });

  it("pads zeros correctly", () => {
    expect(coordinateCacheKey(0, 0)).toBe("0.0000,0.0000");
  });
});

describe("canonicalizeLocationSeed", () => {
  it("builds a full LocationSeed", () => {
    const seed = canonicalizeLocationSeed({
      name: "Fort Collins",
      admin1: "Colorado",
      country: "United States",
      latitude: 40.5853,
      longitude: -105.0844,
      timezone: "America/Denver",
    });
    expect(seed.locationKey).toBe("40.5853,-105.0844");
    expect(seed.displayName).toBe("Fort Collins, Colorado, United States");
    expect(seed.name).toBe("Fort Collins");
    expect(seed.admin1).toBe("Colorado");
    expect(seed.country).toBe("United States");
    expect(seed.latitude).toBe(40.5853);
    expect(seed.longitude).toBe(-105.0844);
    expect(seed.timezone).toBe("America/Denver");
  });

  it("defaults timezone to UTC", () => {
    const seed = canonicalizeLocationSeed({
      name: "Test",
      latitude: 0,
      longitude: 0,
    });
    expect(seed.timezone).toBe("UTC");
  });

  it("defaults admin1 and country to null", () => {
    const seed = canonicalizeLocationSeed({
      name: "Test",
      latitude: 1,
      longitude: 2,
    });
    expect(seed.admin1).toBeNull();
    expect(seed.country).toBeNull();
  });
});

describe("computeTodayVsHistorical", () => {
  const makeObs = (
    date: string,
    maxTemp: number,
    minTemp: number,
    precip: number,
  ): WeatherObservation => ({
    weatherDate: date,
    maxTemperature: maxTemp,
    minTemperature: minTemp,
    precipitation: precip,
  });

  it("falls back to Feb 28 when Feb 29 has no prior data", () => {
    const obs: WeatherObservation[] = [
      makeObs("2023-02-28", 10, 0, 0),
      makeObs("2024-02-29", 15, 5, 2),
    ];
    const result = computeTodayVsHistorical(obs);
    expect(result).not.toBeNull();
    expect(result!.today.weatherDate).toBe("2024-02-29");
    expect(result!.sameDayHistory.length).toBe(1);
    expect(result!.sameDayHistory[0]!.weatherDate).toBe("2023-02-28");
    expect(result!.yearsOfRecord).toBe(1);
  });

  it("uses prior Feb 29 data when available", () => {
    const obs: WeatherObservation[] = [
      makeObs("2020-02-29", 8, -2, 1),
      makeObs("2024-02-29", 15, 5, 2),
    ];
    const result = computeTodayVsHistorical(obs);
    expect(result).not.toBeNull();
    expect(result!.today.weatherDate).toBe("2024-02-29");
    expect(result!.sameDayHistory.length).toBe(1);
    expect(result!.sameDayHistory[0]!.weatherDate).toBe("2020-02-29");
    expect(result!.yearsOfRecord).toBe(1);
  });

  it("returns null when neither Feb 29 nor Feb 28 data exists", () => {
    const obs: WeatherObservation[] = [
      makeObs("2024-01-15", 10, 0, 0),
      makeObs("2024-02-29", 15, 5, 2),
    ];
    const result = computeTodayVsHistorical(obs);
    expect(result).toBeNull();
  });
});
