import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { WeatherObservation } from '$lib/weather';


const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

const databasePath = process.env.WEATHER_LEDGER_DB_PATH ?? resolve(process.cwd(), '../database/weather.duckdb');
const databaseOptions = { access_mode: 'READ_ONLY' };
const rawWeatherQuery = `
	SELECT
		CAST(weather_date AS VARCHAR) AS weatherDate,
		latitude,
		longitude,
		timezone,
		max_temperature_c AS maxTemperatureC,
		precipitation_mm AS precipitationMm,
		source,
		CAST(fetched_at AS VARCHAR) AS fetchedAt
	FROM raw_weather
	ORDER BY weather_date
`;


type DuckDBDatabase = InstanceType<typeof duckdb.Database>;


function openDatabase(): Promise<DuckDBDatabase> {
	return new Promise((resolveDatabase, rejectDatabase) => {
		const database = new duckdb.Database(databasePath, databaseOptions, (openError) => {
			if (openError) {
				rejectDatabase(openError);
				return;
			}

			resolveDatabase(database);
		});
	});
}


function runQuery(database: DuckDBDatabase, query: string): Promise<WeatherObservation[]> {
	return new Promise((resolveRows, rejectRows) => {
		database.all(query, (queryError, rows) => {
			if (queryError) {
				rejectRows(queryError);
				return;
			}

			resolveRows(rows as WeatherObservation[]);
		});
	});
}


function closeDatabase(database: DuckDBDatabase): Promise<void> {
	return new Promise((resolveClose, rejectClose) => {
		database.close((closeError) => {
			if (closeError) {
				rejectClose(closeError);
				return;
			}

			resolveClose();
		});
	});
}


export async function loadWeatherHistory(): Promise<WeatherObservation[]> {
	const database = await openDatabase();
	let queryFailed = false;

	try {
		return await runQuery(database, rawWeatherQuery);
	} catch (error) {
		queryFailed = true;
		throw error;
	} finally {
		try {
			await closeDatabase(database);
		} catch (closeError) {
			if (!queryFailed) {
				throw closeError;
			}
		}
	}
}