import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

export const TEST_DB_PATH = '/tmp/weather-ledger-test.duckdb';

type DB = InstanceType<typeof duckdb.Database>;

function openDb(path: string): Promise<DB> {
	return new Promise((resolve, reject) => {
		const db = new duckdb.Database(path, (err) => {
			if (err) reject(err); else resolve(db);
		});
	});
}

function runSql(db: DB, sql: string): Promise<void> {
	return new Promise((resolve, reject) => {
		db.run(sql, (err) => {
			if (err) reject(err); else resolve();
		});
	});
}

function closeDb(db: DB): Promise<void> {
	return new Promise((resolve) => db.close(() => resolve()));
}

export default async function globalSetup(): Promise<void> {
	process.env.WEATHER_LEDGER_DB_PATH = TEST_DB_PATH;
	try { rmSync(TEST_DB_PATH); } catch {}

	const db = await openDb(TEST_DB_PATH);

	await runSql(db, `
		CREATE TABLE raw_weather (
			weather_date DATE PRIMARY KEY,
			latitude DOUBLE NOT NULL,
			longitude DOUBLE NOT NULL,
			timezone VARCHAR NOT NULL,
			max_temperature_c DOUBLE NOT NULL,
			min_temperature_c DOUBLE NOT NULL,
			avg_temperature_c DOUBLE NOT NULL,
			precipitation_mm DOUBLE NOT NULL,
			wind_speed_kph DOUBLE NOT NULL,
			wind_gust_kph DOUBLE NOT NULL,
			wind_direction_deg DOUBLE NOT NULL,
			pressure_hpa DOUBLE NOT NULL,
			source VARCHAR NOT NULL,
			fetched_at TIMESTAMP NOT NULL
		)
	`);

	await runSql(db, `
		INSERT INTO raw_weather VALUES
			('2026-03-13', 40.5852, -105.0844, 'America/Denver',
			 15.2, 3.1, 9.2, 0.0, 18.5, 32.4, 270, 1018.2,
			 'open-meteo-historical', '2026-03-14T09:00:00Z'),
			('2026-03-14', 40.5852, -105.0844, 'America/Denver',
			 12.8, 1.4, 7.1, 2.3, 22.1, 41.0, 315, 1014.5,
			 'open-meteo-historical', '2026-03-15T09:00:00Z')
	`);

	await runSql(db, `
		CREATE TABLE dashboard_summary (
			observation_count BIGINT NOT NULL,
			total_precipitation_mm DOUBLE NOT NULL,
			avg_high_c DOUBLE NOT NULL,
			wettest_date DATE,
			wettest_precipitation_mm DOUBLE,
			monthly_high_c DOUBLE
		)
	`);

	await runSql(db, `
		INSERT INTO dashboard_summary VALUES
			(2, 2.3, 14.0, '2026-03-14', 2.3, 15.2)
	`);

	await closeDb(db);
}
