import { openDB, type IDBPDatabase } from "idb";
import type { LocationRecord, WeatherObservation } from "./weather";

const DB_NAME = "weather-ledger";
const DB_VERSION = 1;

const LOCATIONS = "locations";
const OBSERVATIONS = "observations";

type ObservationRow = WeatherObservation & { locationKey: string };

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(LOCATIONS, { keyPath: "locationKey" });

      const obsStore = db.createObjectStore(OBSERVATIONS, {
        keyPath: ["locationKey", "weatherDate"],
      });
      obsStore.createIndex("byLocation", "locationKey");
    },
  });
}

export async function getAllLocations(): Promise<LocationRecord[]> {
  const db = await getDb();
  return db.getAll(LOCATIONS);
}

export async function getLocation(
  locationKey: string,
): Promise<LocationRecord | undefined> {
  const db = await getDb();
  return db.get(LOCATIONS, locationKey);
}

export async function putLocation(location: LocationRecord): Promise<void> {
  const db = await getDb();
  await db.put(LOCATIONS, location);
}

export async function deleteLocation(locationKey: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([LOCATIONS, OBSERVATIONS], "readwrite");
  const obsStore = tx.objectStore(OBSERVATIONS);
  const obsKeys = await obsStore.index("byLocation").getAllKeys(locationKey);

  await tx.objectStore(LOCATIONS).delete(locationKey);
  for (const key of obsKeys) {
    await obsStore.delete(key);
  }
  await tx.done;
}

export async function getObservations(
  locationKey: string,
): Promise<WeatherObservation[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex(
    OBSERVATIONS,
    "byLocation",
    locationKey,
  );
  return rows.map((row) => ({
    weatherDate: row.weatherDate,
    maxTemperature: row.maxTemperature,
    minTemperature: row.minTemperature,
    precipitation: row.precipitation,
  }));
}

export async function putObservations(
  locationKey: string,
  observations: WeatherObservation[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(OBSERVATIONS, "readwrite");
  const store = tx.objectStore(OBSERVATIONS);
  for (const obs of observations) {
    await store.put({ ...obs, locationKey } satisfies ObservationRow);
  }
  await tx.done;
}

const PREF_KEYS = {
  units: "pref_units",
  range: "pref_range",
  selectedLocation: "pref_selectedLocation",
} as const;

export function getPreference(key: keyof typeof PREF_KEYS): string | null {
  return localStorage.getItem(PREF_KEYS[key]);
}

export function setPreference(
  key: keyof typeof PREF_KEYS,
  value: string,
): void {
  localStorage.setItem(PREF_KEYS[key], value);
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([LOCATIONS, OBSERVATIONS], "readwrite");
  await Promise.all([
    tx.objectStore(LOCATIONS).clear(),
    tx.objectStore(OBSERVATIONS).clear(),
    tx.done,
  ]);
}
