import { describe, it, expect } from "vitest";
import {
  buildLocationLabel,
  coordinateCacheKey,
  canonicalizeLocationSeed,
  summarizeObservations,
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

describe("summarizeObservations", () => {
  const sampleData: WeatherObservation[] = [
    {
      weatherDate: "2024-01-01",
      maxTemperature: 10,
      minTemperature: 0,
      precipitation: 5,
    },
    {
      weatherDate: "2024-01-02",
      maxTemperature: 20,
      minTemperature: 5,
      precipitation: 10,
    },
    {
      weatherDate: "2024-01-03",
      maxTemperature: 15,
      minTemperature: -2,
      precipitation: 0,
    },
  ];

  it("returns nulls for empty array", () => {
    const summary = summarizeObservations([]);
    expect(summary.observationCount).toBe(0);
    expect(summary.avgHigh).toBeNull();
    expect(summary.avgLow).toBeNull();
    expect(summary.totalPrecipitation).toBe(0);
    expect(summary.hottestDate).toBeNull();
    expect(summary.hottestTemperature).toBeNull();
    expect(summary.wettestDate).toBeNull();
    expect(summary.wettestPrecipitation).toBeNull();
  });

  it("computes correct averages", () => {
    const summary = summarizeObservations(sampleData);
    expect(summary.observationCount).toBe(3);
    expect(summary.avgHigh).toBeCloseTo(15);
    expect(summary.avgLow).toBeCloseTo(1);
  });

  it("computes total precipitation", () => {
    const summary = summarizeObservations(sampleData);
    expect(summary.totalPrecipitation).toBe(15);
  });

  it("finds hottest day", () => {
    const summary = summarizeObservations(sampleData);
    expect(summary.hottestDate).toBe("2024-01-02");
    expect(summary.hottestTemperature).toBe(20);
  });

  it("finds wettest day", () => {
    const summary = summarizeObservations(sampleData);
    expect(summary.wettestDate).toBe("2024-01-02");
    expect(summary.wettestPrecipitation).toBe(10);
  });
});
