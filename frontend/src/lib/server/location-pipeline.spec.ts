import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

type DB = InstanceType<typeof duckdb.Database>;

function openRawDatabase(
	databasePath: string,
	accessMode: 'READ_ONLY' | 'READ_WRITE' = 'READ_WRITE'
): Promise<DB> {
	return new Promise((resolveDatabase, reject) => {
		const db = new duckdb.Database(databasePath, { access_mode: accessMode }, (err) => {
			if (err) {
				reject(err);
				return;
			}

			resolveDatabase(db);
		});
	});
}

function runSql(db: DB, sql: string): Promise<void> {
	return new Promise((resolveRun, reject) => {
		db.run(sql, (err) => {
			if (err) {
				reject(err);
				return;
			}

			resolveRun();
		});
	});
}

function closeRawDatabase(db: DB): Promise<void> {
	return new Promise((resolveClose) => {
		db.close(() => resolveClose());
	});
}

async function seedCachedFortCollins(
	databasePath: string,
	options: { includeLocationCatalog?: boolean } = {}
): Promise<void> {
	const db = await openRawDatabase(databasePath);
	try {
		await runSql(
			db,
			`
			CREATE TABLE raw_locations (
				location_key VARCHAR PRIMARY KEY,
				canonical_name VARCHAR NOT NULL,
				admin1 VARCHAR,
				country VARCHAR,
				country_code VARCHAR,
				latitude DOUBLE NOT NULL,
				longitude DOUBLE NOT NULL,
				timezone VARCHAR NOT NULL,
				geocode_source VARCHAR NOT NULL,
				created_at TIMESTAMP NOT NULL,
				updated_at TIMESTAMP NOT NULL
			)
		`
		);
		await runSql(
			db,
			`
			CREATE TABLE raw_weather (
				location_key VARCHAR NOT NULL,
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
				fetched_at TIMESTAMP NOT NULL,
				PRIMARY KEY (location_key, weather_date)
			)
		`
		);
		await runSql(
			db,
			`
			INSERT INTO raw_locations VALUES (
				'fort-collins-colorado-us',
				'Fort Collins, Colorado, United States',
				'Colorado',
				'United States',
				'US',
				40.5852,
				-105.0844,
				'America/Denver',
				'configured',
				'2026-03-14T09:00:00Z',
				'2026-03-15T09:00:00Z'
			)
		`
		);
		await runSql(
			db,
			`
			INSERT INTO raw_weather VALUES (
				'fort-collins-colorado-us',
				'2099-01-01',
				40.5852,
				-105.0844,
				'America/Denver',
				15.2,
				3.1,
				9.2,
				0.0,
				18.5,
				32.4,
				270,
				1018.2,
				'open-meteo-historical',
				'2026-03-14T09:00:00Z'
			)
		`
		);

		if (options.includeLocationCatalog) {
			await runSql(
				db,
				`
				CREATE TABLE location_catalog (
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
				)
			`
			);
			await runSql(
				db,
				`
				INSERT INTO location_catalog VALUES (
					'fort-collins-colorado-us',
					'Fort Collins, Colorado, United States',
					'Colorado',
					'United States',
					'US',
					40.5852,
					-105.0844,
					'America/Denver',
					1,
					'2099-01-01',
					'2099-01-01',
					'2026-03-14T09:00:00Z'
				)
			`
			);
		}
	} finally {
		await closeRawDatabase(db);
	}
}

describe('location pipeline regression coverage', () => {
	afterEach(() => {
		delete process.env.WEATHER_LEDGER_DB_PATH;
		delete process.env.DBT_DUCKDB_PATH;
		delete process.env.WEATHER_LEDGER_DEFAULT_LOCATION_KEY;
		delete process.env.WEATHER_LEDGER_DEFAULT_LOCATION_NAME;
		delete process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE;
		delete process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE;
		delete process.env.WEATHER_LEDGER_DEFAULT_LOCATION_TIMEZONE;
		delete process.env.WEATHER_LEDGER_TEST_MAP_LOCATION_KEY;
		vi.doUnmock('node:child_process');
		vi.resetModules();
	});

	it('resolves the seeded map override location for deterministic test flows', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'weather-ledger-override-'));
		const databasePath = join(tempDir, 'weather.duckdb');

		try {
			await seedCachedFortCollins(databasePath, { includeLocationCatalog: true });

			process.env.WEATHER_LEDGER_DB_PATH = databasePath;
			process.env.DBT_DUCKDB_PATH = databasePath;
			process.env.WEATHER_LEDGER_TEST_MAP_LOCATION_KEY = 'fort-collins-colorado-us';

			const pipeline = await import('./location-pipeline');

			await expect(pipeline.ensureLocationFromCoordinates(0, 0)).resolves.toMatchObject({
				locationKey: 'fort-collins-colorado-us',
				canonicalName: 'Fort Collins, Colorado, United States',
				rowsStored: 0,
				existingLocation: true
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('serializes concurrent coordinate lookups when the test override is enabled', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'weather-ledger-conc-'));
		const databasePath = join(tempDir, 'weather.duckdb');

		try {
			await seedCachedFortCollins(databasePath, { includeLocationCatalog: true });

			process.env.WEATHER_LEDGER_DB_PATH = databasePath;
			process.env.DBT_DUCKDB_PATH = databasePath;
			process.env.WEATHER_LEDGER_TEST_MAP_LOCATION_KEY = 'fort-collins-colorado-us';

			const pipeline = await import('./location-pipeline');

			const results = await Promise.all([
				pipeline.ensureLocationFromCoordinates(0, 0),
				pipeline.ensureLocationFromCoordinates(1, 1),
				pipeline.ensureLocationFromCoordinates(2, 2)
			]);

			expect(results).toHaveLength(3);
			expect(results.every((result) => result.locationKey === 'fort-collins-colorado-us')).toBe(
				true
			);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it('waits for queued reads before starting the default location pipeline commands', async () => {
		const tempDir = mkdtempSync(join(tmpdir(), 'weather-ledger-lock-'));
		const databasePath = join(tempDir, 'weather.duckdb');

		try {
			await seedCachedFortCollins(databasePath);

			process.env.WEATHER_LEDGER_DB_PATH = databasePath;
			process.env.DBT_DUCKDB_PATH = databasePath;
			process.env.WEATHER_LEDGER_DEFAULT_LOCATION_KEY = 'fort-collins-colorado-us';
			process.env.WEATHER_LEDGER_DEFAULT_LOCATION_NAME = 'Fort Collins, Colorado, United States';
			process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE = '40.5852';
			process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE = '-105.0844';
			process.env.WEATHER_LEDGER_DEFAULT_LOCATION_TIMEZONE = 'America/Denver';

			const spawnCalls: Array<{ command: string; args: string[] }> = [];
			vi.doMock('node:child_process', () => ({
				spawn(command: string, args: string[]) {
					spawnCalls.push({ command, args });
					const child = new EventEmitter() as EventEmitter & {
						stdout: EventEmitter;
						stderr: EventEmitter;
						kill: () => void;
					};
					child.stdout = new EventEmitter();
					child.stderr = new EventEmitter();
					child.kill = () => {};

					queueMicrotask(() => {
						if (args.includes('python')) {
							child.stdout.emit(
								'data',
								JSON.stringify({
									locationKey: 'fort-collins-colorado-us',
									canonicalName: 'Fort Collins, Colorado, United States',
									latitude: 40.5852,
									longitude: -105.0844,
									timezone: 'America/Denver',
									rowsStored: 0,
									startDate: null,
									endDate: null,
									existingLocation: true
								})
							);
						}

						child.emit('close', 0, null);
					});

					return child;
				}
			}));

			const database = await import('./database');
			const pipeline = await import('./location-pipeline');

			const queuedRead = database.withDatabase(async (db) => {
				await new Promise((resolveRead) => setTimeout(resolveRead, 50));
				return database.queryOne<{ value: number }>(db, 'SELECT 1 AS value');
			});
			const refreshPromise = pipeline.ensureDefaultLocationData();

			await new Promise((resolvePause) => setTimeout(resolvePause, 10));
			expect(spawnCalls).toHaveLength(0);

			await queuedRead;

			const refreshResult = await refreshPromise;

			expect(refreshResult).toMatchObject({
				locationKey: 'fort-collins-colorado-us',
				existingLocation: true,
				rowsStored: 0
			});
			expect(spawnCalls).toHaveLength(2);
			expect(spawnCalls[0]).toMatchObject({
				command: 'uv',
				args: expect.arrayContaining(['run', 'python', 'fetch.py', '--json'])
			});
			expect(spawnCalls[1]).toMatchObject({
				command: 'uv',
				args: expect.arrayContaining(['run', 'dbt', 'build'])
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
