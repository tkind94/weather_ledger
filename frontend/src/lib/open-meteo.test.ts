import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  observationsFromArchiveDaily,
  observationsFromArchiveResponse,
  searchRemoteLocations,
  fetchLocationWeather,
} from "./open-meteo";

describe("observationsFromArchiveDaily", () => {
  it("parses valid data", () => {
    const daily = {
      time: ["2024-01-01", "2024-01-02"],
      temperature_2m_max: [10, 20],
      temperature_2m_min: [0, 5],
      precipitation_sum: [5, 10],
    };
    const result = observationsFromArchiveDaily(daily);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      weatherDate: "2024-01-01",
      maxTemperature: 10,
      minTemperature: 0,
      precipitation: 5,
    });
  });

  it("skips rows with null values", () => {
    const daily = {
      time: ["2024-01-01", "2024-01-02", "2024-01-03"],
      temperature_2m_max: [10, null, 15],
      temperature_2m_min: [0, 5, null],
      precipitation_sum: [5, 10, 0],
    };
    const result = observationsFromArchiveDaily(daily);
    expect(result).toHaveLength(1);
    expect(result[0]!.weatherDate).toBe("2024-01-01");
  });

  it("returns empty array for empty input", () => {
    const daily = {
      time: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum: [],
    };
    expect(observationsFromArchiveDaily(daily)).toEqual([]);
  });
});

describe("observationsFromArchiveResponse", () => {
  it("returns empty array when daily is missing", () => {
    expect(observationsFromArchiveResponse({})).toEqual([]);
  });

  it("delegates to observationsFromArchiveDaily", () => {
    const payload = {
      daily: {
        time: ["2024-01-01"],
        temperature_2m_max: [10],
        temperature_2m_min: [0],
        precipitation_sum: [5],
      },
    };
    const result = observationsFromArchiveResponse(payload);
    expect(result).toHaveLength(1);
  });
});

describe("searchRemoteLocations", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns empty array when no results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const result = await searchRemoteLocations("nowhere");
    expect(result).toEqual([]);
  });

  it("maps geocoding results to LocationSeed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            name: "Paris",
            admin1: "Île-de-France",
            country: "France",
            latitude: 48.8566,
            longitude: 2.3522,
            timezone: "Europe/Paris",
          },
        ],
      }),
    });
    const result = await searchRemoteLocations("Paris");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Paris");
    expect(result[0]!.locationKey).toBe("48.8566,2.3522");
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    await expect(searchRemoteLocations("test")).rejects.toThrow(
      "Geocoding request failed: 500",
    );
  });
});

describe("fetchLocationWeather", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches and parses observations", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        daily: {
          time: ["2024-01-01"],
          temperature_2m_max: [10],
          temperature_2m_min: [0],
          precipitation_sum: [5],
        },
      }),
    });
    const location = {
      locationKey: "40.5853,-105.0844",
      displayName: "Fort Collins",
      name: "Fort Collins",
      admin1: "Colorado",
      country: "United States",
      latitude: 40.5853,
      longitude: -105.0844,
      timezone: "America/Denver",
    };
    const result = await fetchLocationWeather(
      location,
      "2024-01-01",
      "2024-01-31",
    );
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });
    const location = {
      locationKey: "0.0000,0.0000",
      displayName: "Test",
      name: "Test",
      admin1: null,
      country: null,
      latitude: 0,
      longitude: 0,
      timezone: "UTC",
    };
    await expect(
      fetchLocationWeather(location, "2024-01-01", "2024-01-31"),
    ).rejects.toThrow("Archive request failed: 429");
  });
});
