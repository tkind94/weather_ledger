import type {
	DashboardPageData,
	DashboardSummary,
	KnownLocation,
	WeatherObservation
} from '$lib/weather';

import { defaultLocation } from '$lib/server/config';
import { queryAll, queryOne, withDatabase } from '$lib/server/database';

const locationFields = `
	location_key AS locationKey,
	canonical_name AS canonicalName,
	admin1,
	country,
	latitude,
	longitude,
	timezone,
	CAST(observation_count AS INTEGER) AS observationCount,
	CAST(first_observation_date AS VARCHAR) AS firstObservationDate,
	CAST(latest_observation_date AS VARCHAR) AS latestObservationDate,
	CAST(last_fetched_at AS VARCHAR) AS lastFetchedAt
`;

const locationCountQuery = `
	SELECT CAST(COUNT(*) AS INTEGER) AS locationCount
	FROM location_catalog
`;

const selectedLocationQuery = `
	SELECT
		${locationFields}
	FROM location_catalog
	WHERE location_key = ?
`;

const fallbackLocationQuery = `
	SELECT
		${locationFields}
	FROM location_catalog
	ORDER BY
		CASE WHEN location_key = ? THEN 0 ELSE 1 END,
		latest_observation_date DESC NULLS LAST,
		canonical_name ASC
	LIMIT 1
`;

const observationsQuery = `
	SELECT
		CAST(weather_date AS VARCHAR) AS weatherDate,
		max_temperature_c AS maxTemperature,
		precipitation_mm AS precipitation
	FROM weather_daily_history
	WHERE location_key = ?
	ORDER BY weather_date
`;

const summaryQuery = `
	SELECT
		location_key AS locationKey,
		CAST(observation_count AS INTEGER) AS observationCount,
		total_precipitation_mm AS totalPrecipitation,
		avg_high_c AS avgHigh,
		CAST(wettest_date AS VARCHAR) AS wettestDate,
		wettest_precipitation_mm AS wettestPrecipitation,
		monthly_high_c AS monthlyHigh
	FROM dashboard_summary
	WHERE location_key = ?
`;

function escapeLikePattern(value: string): string {
	return value.toLowerCase().replace(/([\\%_])/g, '\\$1');
}

function normalizeSearchLimit(limit: number): number {
	return Math.max(1, Math.trunc(limit));
}

function searchQuery(limit: number): string {
	// DuckDB's Node binding under Bun does not reliably bind LIMIT placeholders, so keep
	// the search pattern parameterized and inline only a normalized integer limit.
	return `
		SELECT
			${locationFields}
		FROM location_catalog
		WHERE lower(canonical_name) LIKE ? ESCAPE '\\'
		ORDER BY observation_count DESC, canonical_name ASC
		LIMIT ${normalizeSearchLimit(limit)}
	`;
}

export async function hasCachedLocations(): Promise<boolean> {
	try {
		return await withDatabase(async (db) => {
			const row = await queryOne<{ locationCount: number }>(db, locationCountQuery);
			return (row?.locationCount ?? 0) > 0;
		});
	} catch {
		return false;
	}
}

export async function searchKnownLocations(query: string, limit = 8): Promise<KnownLocation[]> {
	return withDatabase(async (db) => {
		return await queryAll<KnownLocation>(db, searchQuery(limit), [`%${escapeLikePattern(query)}%`]);
	});
}

export async function loadDashboard(locationKey?: string | null): Promise<DashboardPageData> {
	return withDatabase(async (db) => {
		const locationCountRow = await queryOne<{ locationCount: number }>(db, locationCountQuery);
		const selectedLocation = locationKey
			? await queryOne<KnownLocation>(db, selectedLocationQuery, [locationKey])
			: null;
		const fallbackLocation =
			selectedLocation ??
			(await queryOne<KnownLocation>(db, fallbackLocationQuery, [defaultLocation.key]));

		if (fallbackLocation === null) {
			return {
				selectedLocation: null,
				observations: [],
				summary: null,
				locationCount: locationCountRow?.locationCount ?? 0
			};
		}

		const [observations, summary] = await Promise.all([
			queryAll<WeatherObservation>(db, observationsQuery, [fallbackLocation.locationKey]),
			queryOne<DashboardSummary>(db, summaryQuery, [fallbackLocation.locationKey])
		]);

		return {
			selectedLocation: fallbackLocation,
			observations,
			summary,
			locationCount: locationCountRow?.locationCount ?? 0
		};
	});
}
