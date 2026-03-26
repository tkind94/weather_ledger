import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { DashboardSummary, WeatherObservation } from '$lib/weather';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

const databasePath =
	process.env.WEATHER_LEDGER_DB_PATH ?? resolve(process.cwd(), '../database/weather.duckdb');

type DB = InstanceType<typeof duckdb.Database>;

function openDatabase(): Promise<DB> {
	return new Promise((resolve, reject) => {
		const db = new duckdb.Database(databasePath, { access_mode: 'READ_ONLY' }, (err) => {
			if (err) reject(err);
			else resolve(db);
		});
	});
}

function queryAll<T>(db: DB, sql: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		db.all(sql, (err, rows) => {
			if (err) reject(err);
			else resolve(rows as T[]);
		});
	});
}

const observationsQuery = `
	SELECT
		CAST(weather_date AS VARCHAR) AS weatherDate,
		max_temperature_c AS maxTemperatureC,
		precipitation_mm AS precipitationMm
	FROM raw_weather
	ORDER BY weather_date
`;

const summaryQuery = `
	SELECT
		observation_count AS observationCount,
		total_precipitation_mm AS totalPrecipitationMm,
		avg_high_c AS avgHighC,
		CAST(wettest_date AS VARCHAR) AS wettestDate,
		wettest_precipitation_mm AS wettestPrecipitationMm,
		monthly_high_c AS monthlyHighC
	FROM dashboard_summary
`;

export async function loadDashboard(): Promise<{
	observations: WeatherObservation[];
	summary: DashboardSummary | null;
}> {
	const db = await openDatabase();
	try {
		const [observations, summaryRows] = await Promise.all([
			queryAll<WeatherObservation>(db, observationsQuery),
			queryAll<DashboardSummary>(db, summaryQuery)
		]);
		return { observations, summary: summaryRows[0] ?? null };
	} finally {
		db.close(() => {});
	}
}
