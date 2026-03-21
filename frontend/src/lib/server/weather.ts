import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { MonthlyExtremeRow, WeatherObservation } from '$lib/weather';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

const databasePath =
	process.env.WEATHER_LEDGER_DB_PATH ?? resolve(process.cwd(), '../database/weather.duckdb');

function query<T>(sql: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const db = new duckdb.Database(databasePath, { access_mode: 'READ_ONLY' }, (openError) => {
			if (openError) { reject(openError); return; }
			db.all(sql, (queryError, rows) => {
				db.close(() => {});
				if (queryError) { reject(queryError); return; }
				resolve(rows as T[]);
			});
		});
	});
}

const weatherHistoryQuery = `
	SELECT
		CAST(weather_date AS VARCHAR) AS weatherDate,
		latitude,
		longitude,
		timezone,
		max_temperature_c AS maxTemperatureC,
		min_temperature_c AS minTemperatureC,
		avg_temperature_c AS avgTemperatureC,
		precipitation_mm AS precipitationMm,
		wind_speed_kph AS windSpeedKph,
		wind_gust_kph AS windGustKph,
		wind_direction_deg AS windDirectionDeg,
		pressure_hpa AS pressureHpa,
		source,
		CAST(fetched_at AS VARCHAR) AS fetchedAt
	FROM raw_weather
	ORDER BY weather_date
`;

const monthlyExtremesQuery = `
	SELECT month, latitude, longitude, monthly_max_c, monthly_min_c
	FROM weather_monthly_extremes
	ORDER BY month
`;

export const loadWeatherHistory = () => query<WeatherObservation>(weatherHistoryQuery);
export const loadMonthlyExtremes = () => query<MonthlyExtremeRow>(monthlyExtremesQuery);
