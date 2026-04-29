import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock idb before importing storage
const mockGetAll = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
const mockGetAllFromIndex = vi.fn();
const mockGetAllKeys = vi.fn();

const mockLocationsStore = {
  delete: vi.fn(),
};

const mockObservationsStore = {
  put: mockPut,
  delete: mockDelete,
  index: vi.fn().mockReturnValue({ getAllKeys: mockGetAllKeys }),
};

const mockTransaction = {
  objectStore: vi.fn((name: string) =>
    name === "locations" ? mockLocationsStore : mockObservationsStore,
  ),
  done: Promise.resolve(),
};

const mockDb = {
  getAll: mockGetAll,
  get: mockGet,
  put: mockPut,
  getAllFromIndex: mockGetAllFromIndex,
  transaction: vi.fn().mockReturnValue(mockTransaction),
};

vi.mock("idb", () => ({
  openDB: vi.fn().mockResolvedValue(mockDb),
}));

// Now import storage (it will use the mocked idb)
const {
  getAllLocations,
  putLocation,
  getObservations,
  putObservations,
  deleteLocation,
} = await import("./storage");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.transaction.mockReturnValue(mockTransaction);
  mockTransaction.objectStore.mockImplementation((name: string) =>
    name === "locations" ? mockLocationsStore : mockObservationsStore,
  );
  mockObservationsStore.index.mockReturnValue({ getAllKeys: mockGetAllKeys });
});

describe("getAllLocations", () => {
  it("returns all locations from the store", async () => {
    const locations = [
      {
        locationKey: "40.5853,-105.0844",
        displayName: "Fort Collins",
        name: "Fort Collins",
        admin1: "Colorado",
        country: "United States",
        latitude: 40.5853,
        longitude: -105.0844,
        timezone: "America/Denver",
        observationCount: 10,
        firstObservationDate: "2024-01-01",
        latestObservationDate: "2024-01-10",
        lastFetchedAt: "2024-01-10T12:00:00Z",
      },
    ];
    mockGetAll.mockResolvedValueOnce(locations);
    const result = await getAllLocations();
    expect(result).toEqual(locations);
    expect(mockGetAll).toHaveBeenCalledWith("locations");
  });
});

describe("putLocation", () => {
  it("puts a location into the store", async () => {
    mockPut.mockResolvedValueOnce(undefined);
    const location = {
      locationKey: "40.5853,-105.0844",
      displayName: "Fort Collins",
      name: "Fort Collins",
      admin1: "Colorado",
      country: "United States",
      latitude: 40.5853,
      longitude: -105.0844,
      timezone: "America/Denver",
      observationCount: 0,
      firstObservationDate: null,
      latestObservationDate: null,
      lastFetchedAt: null,
    };
    await putLocation(location);
    expect(mockPut).toHaveBeenCalledWith("locations", location);
  });
});

describe("getObservations", () => {
  it("returns observations for a location", async () => {
    const rows = [
      {
        locationKey: "40.5853,-105.0844",
        weatherDate: "2024-01-01",
        maxTemperature: 10,
        minTemperature: 0,
        precipitation: 5,
      },
    ];
    mockGetAllFromIndex.mockResolvedValueOnce(rows);
    const result = await getObservations("40.5853,-105.0844");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      weatherDate: "2024-01-01",
      maxTemperature: 10,
      minTemperature: 0,
      precipitation: 5,
    });
    // Should strip locationKey from returned data
    expect(result[0]).not.toHaveProperty("locationKey");
  });
});

describe("putObservations", () => {
  it("puts observations with locationKey", async () => {
    mockPut.mockResolvedValue(undefined);
    const observations = [
      {
        weatherDate: "2024-01-01",
        maxTemperature: 10,
        minTemperature: 0,
        precipitation: 5,
      },
    ];
    await putObservations("40.5853,-105.0844", observations);
    expect(mockPut).toHaveBeenCalledWith({
      weatherDate: "2024-01-01",
      maxTemperature: 10,
      minTemperature: 0,
      precipitation: 5,
      locationKey: "40.5853,-105.0844",
    });
  });
});

describe("deleteLocation", () => {
  it("deletes location and its observations", async () => {
    const obsKeys = [
      ["40.5853,-105.0844", "2024-01-01"],
      ["40.5853,-105.0844", "2024-01-02"],
    ];
    mockGetAllKeys.mockResolvedValueOnce(obsKeys);
    mockDelete.mockResolvedValue(undefined);

    await deleteLocation("40.5853,-105.0844");

    // Should delete the location from locations store
    expect(mockLocationsStore.delete).toHaveBeenCalledWith("40.5853,-105.0844");
    // Should delete each observation from observations store
    expect(mockDelete).toHaveBeenCalledTimes(2);
  });
});
