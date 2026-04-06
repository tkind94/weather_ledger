import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

/** Create the DuckDB file so READ_ONLY opens succeed. */
function touchDatabase(dbPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const db = new duckdb.Database(dbPath, { access_mode: 'READ_WRITE' }, (err) => {
			if (err) {
				reject(err);
				return;
			}
			db.close(() => resolve());
		});
	});
}

describe('database access layer', () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		delete process.env.WEATHER_LEDGER_DB_PATH;
		delete process.env.WEATHER_LEDGER_LEDGER_PATH;
		vi.resetModules();
	});

	async function setupTempDb(): Promise<string> {
		tempDir = mkdtempSync(join(tmpdir(), 'weather-ledger-db-'));
		const dbPath = join(tempDir, 'test.duckdb');
		await touchDatabase(dbPath);
		process.env.WEATHER_LEDGER_DB_PATH = dbPath;
		return dbPath;
	}

	it('withDatabase opens and closes a connection cleanly', async () => {
		expect.assertions(1);
		await setupTempDb();
		const { withDatabase, queryOne } = await import('./database');

		const result = await withDatabase(async (db) => {
			return queryOne<{ v: number }>(db, 'SELECT 1 AS v');
		});

		expect(result).toEqual({ v: 1 });
	});

	it('withDatabase closes the connection even when the task throws', async () => {
		expect.assertions(2);
		await setupTempDb();
		const { withDatabase, queryOne } = await import('./database');

		await expect(
			withDatabase(async () => {
				throw new Error('deliberate failure');
			})
		).rejects.toThrow('deliberate failure');

		// If the previous connection leaked, this would deadlock or fail with a lock error
		const result = await withDatabase(async (db) => {
			return queryOne<{ v: number }>(db, 'SELECT 42 AS v');
		});
		expect(result).toEqual({ v: 42 });
	});

	it('runWithExclusiveDatabaseAccess serializes concurrent tasks', async () => {
		expect.assertions(1);
		await setupTempDb();
		const { runWithExclusiveDatabaseAccess } = await import('./database');

		const events: string[] = [];

		const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

		const task = (label: string) => async () => {
			events.push(`${label}:start`);
			await delay(30);
			events.push(`${label}:end`);
		};

		await Promise.all([
			runWithExclusiveDatabaseAccess(task('a')),
			runWithExclusiveDatabaseAccess(task('b')),
			runWithExclusiveDatabaseAccess(task('c'))
		]);

		// Each task's end must appear before the next task's start
		expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
	});

	it('concurrent withDatabase calls do not produce lock errors', async () => {
		expect.assertions(1);
		await setupTempDb();
		const { withDatabase, queryOne } = await import('./database');

		// Read-only connections should be able to coexist on the published snapshot.
		const results = await Promise.all(
			Array.from({ length: 5 }, (_, i) =>
				withDatabase(async (db) => {
					return queryOne<{ v: number }>(db, `SELECT ${i} AS v`);
				})
			)
		);

		expect(results.map((r) => r?.v)).toEqual([0, 1, 2, 3, 4]);
	});

	it('queryOne returns null for an empty result set', async () => {
		expect.assertions(1);
		await setupTempDb();
		const { withDatabase, queryOne } = await import('./database');

		const result = await withDatabase(async (db) => {
			return queryOne<{ v: number }>(db, 'SELECT 1 AS v WHERE false');
		});

		expect(result).toBeNull();
	});

	it('queryAll returns an empty array for no matches', async () => {
		expect.assertions(1);
		await setupTempDb();
		const { withDatabase, queryAll } = await import('./database');

		const result = await withDatabase(async (db) => {
			return queryAll<{ v: number }>(db, 'SELECT 1 AS v WHERE false');
		});

		expect(result).toEqual([]);
	});
});
