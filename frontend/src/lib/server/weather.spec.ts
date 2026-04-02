import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

type DB = InstanceType<typeof duckdb.Database>;

function openRaw(path: string): Promise<DB> {
	return new Promise((res, rej) => {
		const db = new duckdb.Database(path, { access_mode: 'READ_WRITE' }, (err) =>
			err ? rej(err) : res(db)
		);
	});
}

function sql(db: DB, statement: string): Promise<void> {
	return new Promise((res, rej) => db.run(statement, (err) => (err ? rej(err) : res())));
}

function closeRaw(db: DB): Promise<void> {
	return new Promise((res) => db.close(() => res()));
}

/** Create all tables and optionally seed 3 Colorado locations with 2 days each. */
async function seedFullDatabase(dbPath: string, insertRows = true): Promise<void> {
	const db = await openRaw(dbPath);
	try {
		await sql(
			db,
			`CREATE TABLE location_catalog (
				location_key VARCHAR PRIMARY KEY,
				canonical_name VARCHAR NOT NULL,
				admin1 VARCHAR,
				country VARCHAR,
				country_code VARCHAR,
				latitude DOUBLE NOT NULL,
				longitude DOUBLE NOT NULL,
				timezone VARCHAR NOT NULL,
				observation_count BIGINT NOT NULL,
				first_observation_date DATE,
				latest_observation_date DATE,
				last_fetched_at TIMESTAMP
			)`
		);
		await sql(
			db,
			`CREATE TABLE weather_daily_history (
				location_key VARCHAR NOT NULL,
				canonical_name VARCHAR NOT NULL,
				admin1 VARCHAR,
				country VARCHAR,
				country_code VARCHAR,
				weather_date DATE NOT NULL,
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
			)`
		);
		await sql(
			db,
			`CREATE TABLE dashboard_summary (
				location_key VARCHAR PRIMARY KEY,
				observation_count BIGINT NOT NULL,
				total_precipitation_mm DOUBLE NOT NULL,
				avg_high_c DOUBLE NOT NULL,
				wettest_date DATE,
				wettest_precipitation_mm DOUBLE,
				monthly_high_c DOUBLE
			)`
		);

		if (!insertRows) return;

		await sql(
			db,
			`INSERT INTO location_catalog VALUES
				('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', 40.5852, -105.0844, 'America/Denver', 2, '2026-03-13', '2026-03-14', '2026-03-15T09:00:00Z'),
				('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', 40.01499, -105.27055, 'America/Denver', 2, '2026-03-13', '2026-03-14', '2026-03-15T09:00:00Z'),
				('loveland-colorado-us', 'Loveland, Colorado, United States', 'Colorado', 'United States', 'US', 40.39776, -105.07498, 'America/Denver', 2, '2026-03-13', '2026-03-14', '2026-03-15T09:00:00Z')`
		);
		await sql(
			db,
			`INSERT INTO weather_daily_history VALUES
				('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-13', 40.5852, -105.0844, 'America/Denver', 15.2, 3.1, 9.2, 0.0, 18.5, 32.4, 270, 1018.2, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
				('fort-collins-colorado-us', 'Fort Collins, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-14', 40.5852, -105.0844, 'America/Denver', 12.8, 1.4, 7.1, 2.3, 22.1, 41.0, 315, 1014.5, 'open-meteo-historical', '2026-03-15T09:00:00Z'),
				('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-13', 40.01499, -105.27055, 'America/Denver', 13.1, 2.0, 8.0, 1.1, 16.0, 28.5, 290, 1017.0, 'open-meteo-historical', '2026-03-14T09:00:00Z'),
				('boulder-colorado-us', 'Boulder, Colorado, United States', 'Colorado', 'United States', 'US', '2026-03-14', 40.01499, -105.27055, 'America/Denver', 10.2, 0.6, 5.5, 4.8, 20.4, 36.0, 300, 1012.8, 'open-meteo-historical', '2026-03-15T09:00:00Z')`
		);
		await sql(
			db,
			`INSERT INTO dashboard_summary VALUES
				('fort-collins-colorado-us', 2, 2.3, 14.0, '2026-03-14', 2.3, 15.2),
				('boulder-colorado-us', 2, 5.9, 11.65, '2026-03-14', 4.8, 13.1),
				('loveland-colorado-us', 2, 3.6, 12.75, '2026-03-14', 3.4, 14.4)`
		);
	} finally {
		await closeRaw(db);
	}
}

describe('weather server queries', () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		delete process.env.WEATHER_LEDGER_DB_PATH;
		vi.resetModules();
	});

	async function setup(insertRows = true) {
		tempDir = mkdtempSync(join(tmpdir(), 'weather-ledger-wq-'));
		const dbPath = join(tempDir, 'weather.duckdb');
		await seedFullDatabase(dbPath, insertRows);
		process.env.WEATHER_LEDGER_DB_PATH = dbPath;
		return import('./weather');
	}

	// --- hasCachedLocations ---

	it('hasCachedLocations returns true when rows exist', async () => {
		expect.assertions(1);
		const { hasCachedLocations } = await setup();
		expect(await hasCachedLocations()).toBe(true);
	});

	it('hasCachedLocations returns false on empty catalog', async () => {
		expect.assertions(1);
		const { hasCachedLocations } = await setup(false);
		expect(await hasCachedLocations()).toBe(false);
	});

	it('hasCachedLocations returns false when database file does not exist', async () => {
		expect.assertions(1);
		tempDir = mkdtempSync(join(tmpdir(), 'weather-ledger-wq-'));
		process.env.WEATHER_LEDGER_DB_PATH = join(tempDir, 'nonexistent.duckdb');
		const { hasCachedLocations } = await import('./weather');
		expect(await hasCachedLocations()).toBe(false);
	});

	// --- loadDashboard ---

	it('loadDashboard falls back to default location when no key given', async () => {
		expect.assertions(3);
		const { loadDashboard } = await setup();
		const result = await loadDashboard();
		expect(result.selectedLocation?.locationKey).toBe('fort-collins-colorado-us');
		expect(result.observations.length).toBe(2);
		expect(result.summary).not.toBeNull();
	});

	it('loadDashboard selects a requested location by key', async () => {
		expect.assertions(2);
		const { loadDashboard } = await setup();
		const result = await loadDashboard('boulder-colorado-us');
		expect(result.selectedLocation?.canonicalName).toBe('Boulder, Colorado, United States');
		expect(result.observations.every((o) => o.maxTemperature <= 13.1)).toBe(true);
	});

	it('loadDashboard returns empty state when catalog is empty', async () => {
		expect.assertions(4);
		const { loadDashboard } = await setup(false);
		const result = await loadDashboard();
		expect(result.selectedLocation).toBeNull();
		expect(result.observations).toEqual([]);
		expect(result.summary).toBeNull();
		expect(result.locationCount).toBe(0);
	});

	it('loadDashboard returns correct locationCount', async () => {
		expect.assertions(1);
		const { loadDashboard } = await setup();
		const result = await loadDashboard();
		expect(result.locationCount).toBe(3);
	});

	it('loadDashboard falls back when requested key does not exist', async () => {
		expect.assertions(1);
		const { loadDashboard } = await setup();
		const result = await loadDashboard('nonexistent-key');
		// Falls through selectedLocationQuery (null) to fallbackLocationQuery (Fort Collins default)
		expect(result.selectedLocation?.locationKey).toBe('fort-collins-colorado-us');
	});

	// --- searchKnownLocations ---

	it('searchKnownLocations matches by case-insensitive substring', async () => {
		expect.assertions(2);
		const { searchKnownLocations } = await setup();
		const results = await searchKnownLocations('boulder');
		expect(results).toHaveLength(1);
		expect(results[0].canonicalName).toBe('Boulder, Colorado, United States');
	});

	it('searchKnownLocations respects limit parameter', async () => {
		expect.assertions(1);
		const { searchKnownLocations } = await setup();
		const results = await searchKnownLocations('colorado', 1);
		expect(results).toHaveLength(1);
	});
});
