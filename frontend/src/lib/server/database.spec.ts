import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

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

type ChildResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

type SpawnedChild = ChildProcessByStdio<null, Readable, Readable>;

type TrackedChild = {
	child: SpawnedChild;
	result: Promise<ChildResult>;
	waitForStdout: (expected: string) => Promise<void>;
};

function databaseModuleUrl(): string {
	return pathToFileURL(join(process.cwd(), 'src/lib/server/database.ts')).href;
}

function spawnBunEval(code: string, env: NodeJS.ProcessEnv): TrackedChild {
	const child = spawn('bun', ['--eval', code], {
		cwd: process.cwd(),
		env: {
			...process.env,
			...env
		},
		stdio: ['ignore', 'pipe', 'pipe']
	});

	let stdout = '';
	let stderr = '';

	child.stdout.on('data', (chunk) => {
		stdout += chunk.toString();
	});

	child.stderr.on('data', (chunk) => {
		stderr += chunk.toString();
	});

	const result = new Promise<ChildResult>((resolve) => {
		child.on('close', (exitCode) => {
			resolve({ exitCode: exitCode ?? -1, stdout, stderr });
		});
	});

	function waitForStdout(expected: string): Promise<void> {
		if (stdout.includes(expected)) {
			return Promise.resolve();
		}

		return new Promise((resolveWait, reject) => {
			const onStdout = () => {
				if (!stdout.includes(expected)) {
					return;
				}

				cleanup();
				resolveWait();
			};

			const onClose = (exitCode: number | null) => {
				cleanup();
				reject(
					new Error(
						`Child exited before emitting ${expected}: code=${exitCode ?? -1}\nstdout:\n${stdout}\nstderr:\n${stderr}`
					)
				);
			};

			const cleanup = () => {
				child.stdout.off('data', onStdout);
				child.off('close', onClose);
			};

			child.stdout.on('data', onStdout);
			child.on('close', onClose);
		});
	}

	return { child, result, waitForStdout };
}

describe('database access layer', () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		delete process.env.WEATHER_LEDGER_DB_PATH;
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

		// The serialization queue should prevent concurrent DuckDB opens
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

	it('serializes database access across Bun processes', async () => {
		expect.assertions(4);
		const dbPath = await setupTempDb();
		const moduleUrl = databaseModuleUrl();

		const reader = spawnBunEval(
			[
				'(async () => {',
				`const { withDatabase } = await import(${JSON.stringify(moduleUrl)});`,
				'await withDatabase(async () => {',
				"console.log('READY');",
				'await new Promise((resolve) => setTimeout(resolve, 300));',
				'return null;',
				'});',
				"console.log('READER_DONE');",
				'})().catch((error) => {',
				'console.error(error instanceof Error ? error.stack ?? error.message : String(error));',
				'process.exit(1);',
				'});'
			].join('\n'),
			{ WEATHER_LEDGER_DB_PATH: dbPath }
		);

		await reader.waitForStdout('READY');

		const writer = spawnBunEval(
			[
				'(async () => {',
				"const { createRequire } = await import('node:module');",
				'const require = createRequire(import.meta.url);',
				"const duckdb = require('duckdb');",
				`const { runWithExclusiveDatabaseAccess } = await import(${JSON.stringify(moduleUrl)});`,
				'await runWithExclusiveDatabaseAccess(async () => {',
				'await new Promise((resolve, reject) => {',
				"const db = new duckdb.Database(process.env.WEATHER_LEDGER_DB_PATH, { access_mode: 'READ_WRITE' }, (err) => {",
				'if (err) {',
				'reject(err);',
				'return;',
				'}',
				'db.close(() => resolve(undefined));',
				'});',
				'});',
				'});',
				"console.log('WRITE_OK');",
				'})().catch((error) => {',
				'console.error(error instanceof Error ? error.stack ?? error.message : String(error));',
				'process.exit(1);',
				'});'
			].join('\n'),
			{ WEATHER_LEDGER_DB_PATH: dbPath }
		);

		const [readerResult, writerResult] = await Promise.all([reader.result, writer.result]);

		expect(readerResult.exitCode).toBe(0);
		expect(writerResult.exitCode).toBe(0);
		expect(readerResult.stdout).toContain('READER_DONE');
		expect(writerResult.stdout).toContain('WRITE_OK');
	});
});
