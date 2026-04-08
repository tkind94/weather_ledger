import 'server-only';

import { defaultLocation, historyStartDate } from '@/lib/server/config';
import { fetchLocationWeather, searchRemoteLocations } from '@/lib/server/open-meteo';
import { getDatabase } from '@/lib/server/sqlite';
import {
	buildLocationLabel,
	summarizeObservations,
	type DashboardData,
	type LocationCandidate,
	type LocationRecord,
	type LocationSeed,
	type WeatherObservation
} from '@/lib/weather';

type LocationRow = {
	locationKey: string;
	displayName: string;
	name: string;
	admin1: string | null;
	country: string | null;
	latitude: number;
	longitude: number;
	timezone: string;
	observationCount: number;
	firstObservationDate: string | null;
	latestObservationDate: string | null;
	lastFetchedAt: string | null;
};

const locationSelect = `
	SELECT
		l.location_key AS locationKey,
		l.display_name AS displayName,
		l.name AS name,
		l.admin1 AS admin1,
		l.country AS country,
		l.latitude AS latitude,
		l.longitude AS longitude,
		l.timezone AS timezone,
		CAST(COUNT(w.observation_date) AS INTEGER) AS observationCount,
		MIN(w.observation_date) AS firstObservationDate,
		MAX(w.observation_date) AS latestObservationDate,
		l.last_fetched_at AS lastFetchedAt
	FROM locations l
	LEFT JOIN daily_weather w ON w.location_key = l.location_key
`;

function mapLocation(row: LocationRow): LocationRecord {
	return {
		locationKey: row.locationKey,
		displayName: row.displayName,
		name: row.name,
		admin1: row.admin1,
		country: row.country,
		latitude: Number(row.latitude),
		longitude: Number(row.longitude),
		timezone: row.timezone,
		observationCount: Number(row.observationCount),
		firstObservationDate: row.firstObservationDate,
		latestObservationDate: row.latestObservationDate,
		lastFetchedAt: row.lastFetchedAt
	};
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number): string {
	const date = new Date(`${dateString}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return isoDate(date);
}

function escapeLikePattern(value: string): string {
	return value.toLowerCase().replace(/([\\%_])/g, '\\$1');
}

function cachedLocationRows(whereClause = '', params: unknown[] = []): LocationRecord[] {
	const database = getDatabase();
	const suffix = whereClause === '' ? '' : ` ${whereClause}`;
	const query = `${locationSelect}${suffix}
	GROUP BY l.location_key
	ORDER BY datetime(l.last_fetched_at) DESC, l.display_name ASC`;
	const rows = database.prepare(query).all(...params) as LocationRow[];
	return rows.map(mapLocation);
}

function latestObservationDate(locationKey: string): string | null {
	const database = getDatabase();
	const row = database
		.prepare(
			`SELECT MAX(observation_date) AS latestObservationDate FROM daily_weather WHERE location_key = ?`
		)
		.get(locationKey) as { latestObservationDate: string | null } | undefined;

	return row?.latestObservationDate ?? null;
}

function writeLocationWeather(
	location: LocationSeed,
	observations: WeatherObservation[],
	fetchedAt: string
): void {
	const database = getDatabase();
	const upsertLocation = database.prepare(`
		INSERT INTO locations (
			location_key,
			display_name,
			name,
			admin1,
			country,
			latitude,
			longitude,
			timezone,
			last_fetched_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(location_key) DO UPDATE SET
			display_name = excluded.display_name,
			name = excluded.name,
			admin1 = excluded.admin1,
			country = excluded.country,
			latitude = excluded.latitude,
			longitude = excluded.longitude,
			timezone = excluded.timezone,
			last_fetched_at = excluded.last_fetched_at,
			updated_at = CURRENT_TIMESTAMP
	`);
	const upsertObservation = database.prepare(`
		INSERT INTO daily_weather (
			location_key,
			observation_date,
			max_temperature_c,
			min_temperature_c,
			precipitation_mm
		)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(location_key, observation_date) DO UPDATE SET
			max_temperature_c = excluded.max_temperature_c,
			min_temperature_c = excluded.min_temperature_c,
			precipitation_mm = excluded.precipitation_mm
	`);

	const transaction = database.transaction(() => {
		upsertLocation.run(
			location.locationKey,
			location.displayName,
			location.name,
			location.admin1,
			location.country,
			location.latitude,
			location.longitude,
			location.timezone,
			fetchedAt
		);

		for (const observation of observations) {
			upsertObservation.run(
				location.locationKey,
				observation.weatherDate,
				observation.maxTemperature,
				observation.minTemperature,
				observation.precipitation
			);
		}
	});

	transaction();
}

function toCandidate(location: LocationRecord, isCached: boolean): LocationCandidate {
	return {
		locationKey: location.locationKey,
		displayName: location.displayName,
		name: location.name,
		admin1: location.admin1,
		country: location.country,
		latitude: location.latitude,
		longitude: location.longitude,
		timezone: location.timezone,
		isCached
	};
}

export function listCachedLocations(): LocationRecord[] {
	return cachedLocationRows();
}

export function hasCachedLocations(): boolean {
	return listCachedLocations().length > 0;
}

export function searchCachedLocations(query: string, limit = 5): LocationRecord[] {
	if (query.trim() === '') {
		return listCachedLocations().slice(0, limit);
	}

	const normalizedLimit = Math.max(1, Math.trunc(limit));
	const database = getDatabase();
	const rows = database
		.prepare(
			`${locationSelect}
			WHERE lower(l.display_name) LIKE ? ESCAPE '\\'
			GROUP BY l.location_key
			ORDER BY datetime(l.last_fetched_at) DESC, l.display_name ASC
			LIMIT ${normalizedLimit}`
		)
		.all(`%${escapeLikePattern(query)}%`) as LocationRow[];

	return rows.map(mapLocation);
}

export async function ensureDefaultLocationData(): Promise<void> {
	if (hasCachedLocations()) {
		return;
	}

	await cacheLocationWeather(defaultLocation());
}

export async function cacheLocationWeather(location: LocationSeed): Promise<LocationRecord> {
	const newestDate = latestObservationDate(location.locationKey);
	const today = isoDate(new Date());
	const startDate =
		newestDate === null
			? historyStartDate
			: ([historyStartDate, addDays(newestDate, -14)].sort().at(-1) ?? historyStartDate);
	const observations = await fetchLocationWeather(location, startDate, today);

	if (observations.length === 0) {
		throw new Error(`Open-Meteo returned no daily observations for ${location.displayName}.`);
	}

	writeLocationWeather(location, observations, new Date().toISOString());

	const updatedLocation = cachedLocationRows('WHERE l.location_key = ?', [location.locationKey]).at(
		0
	);
	if (!updatedLocation) {
		throw new Error(`Cached location ${location.displayName} could not be reloaded from SQLite.`);
	}

	return updatedLocation;
}

export async function searchLocations(query: string): Promise<LocationCandidate[]> {
	const cachedMatches = searchCachedLocations(query, 4).map((location) =>
		toCandidate(location, true)
	);
	if (query.trim().length < 2) {
		return cachedMatches;
	}

	const cachedKeys = new Set(listCachedLocations().map((location) => location.locationKey));
	let remoteMatches: LocationCandidate[] = [];

	try {
		const remote = await searchRemoteLocations(query);
		remoteMatches = remote.map((location) => ({
			...location,
			displayName:
				location.displayName ||
				buildLocationLabel({
					name: location.name,
					admin1: location.admin1,
					country: location.country
				}),
			isCached: cachedKeys.has(location.locationKey)
		}));
	} catch {
		return cachedMatches;
	}

	const merged = new Map<string, LocationCandidate>();
	for (const location of remoteMatches) {
		merged.set(location.locationKey, location);
	}
	for (const location of cachedMatches) {
		if (!merged.has(location.locationKey)) {
			merged.set(location.locationKey, location);
		}
	}

	return Array.from(merged.values()).slice(0, 8);
}

export function observationsForLocation(locationKey: string): WeatherObservation[] {
	const database = getDatabase();
	return database
		.prepare(
			`SELECT
				observation_date AS weatherDate,
				max_temperature_c AS maxTemperature,
				min_temperature_c AS minTemperature,
				precipitation_mm AS precipitation
			FROM daily_weather
			WHERE location_key = ?
			ORDER BY observation_date ASC`
		)
		.all(locationKey) as WeatherObservation[];
}

export async function loadDashboard(locationKey?: string): Promise<DashboardData> {
	await ensureDefaultLocationData();

	const cachedLocations = listCachedLocations();
	const selectedLocation =
		(locationKey
			? cachedLocations.find((location) => location.locationKey === locationKey)
			: null) ??
		cachedLocations[0] ??
		null;

	if (selectedLocation === null) {
		return {
			cachedLocations: [],
			selectedLocation: null,
			observations: [],
			summary: null
		};
	}

	const observations = observationsForLocation(selectedLocation.locationKey);
	return {
		cachedLocations,
		selectedLocation,
		observations,
		summary: summarizeObservations(observations)
	};
}
