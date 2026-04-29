import { describe, it, expect } from "vitest";
import {
  buildLocationLabel,
  coordinateCacheKey,
  canonicalizeLocationSeed,
  coordinateLabel,
  formatDate,
  formatTimestamp,
  formatTemperature,
  formatPrecipitation,
  formatDateRange,
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

describe("coordinateLabel", () => {
  it("formats northern/eastern coordinates", () => {
    expect(coordinateLabel(40.585, -105.084)).toBe("40.585° N, 105.084° W");
  });

  it("formats southern/western coordinates", () => {
    expect(coordinateLabel(-33.8688, 151.2093)).toBe("33.869° S, 151.209° E");
  });

  it("handles zero coordinates", () => {
    expect(coordinateLabel(0, 0)).toBe("0.000° N, 0.000° E");
  });
});

describe("formatDate", () => {
  it("formats a date string in UTC", () => {
    const result = formatDate("2024-01-15");
    expect(result).toBe("Jan 15, 2024");
  });
});

describe("formatTimestamp", () => {
  it("formats an ISO timestamp in UTC", () => {
    const result = formatTimestamp("2024-01-15T14:30:00Z");
    expect(result).toMatch(/Jan 15/);
    expect(result).toMatch(/2:30 PM/);
  });
});

describe("formatTemperature", () => {
  it("formats with one decimal and °C suffix", () => {
    expect(formatTemperature(23.456)).toBe("23.5°C");
  });

  it("handles negative values", () => {
    expect(formatTemperature(-5.1)).toBe("-5.1°C");
  });
});

describe("formatPrecipitation", () => {
  it("formats with one decimal and mm suffix", () => {
    expect(formatPrecipitation(12.345)).toBe("12.3 mm");
  });

  it("handles zero", () => {
    expect(formatPrecipitation(0)).toBe("0.0 mm");
  });
});

describe("formatDateRange", () => {
  it("formats a range with en dash", () => {
    const result = formatDateRange("2024-01-01", "2024-01-31");
    expect(result).toBe("Jan 1, 2024 – Jan 31, 2024");
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
