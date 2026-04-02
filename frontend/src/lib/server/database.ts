import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { withInterprocessLock } from './interprocess-lock';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

export const databasePath =
	process.env.WEATHER_LEDGER_DB_PATH ?? resolve(process.cwd(), '../database/weather.duckdb');
const databaseLockPath = `${databasePath}.access.lock`;

type DB = InstanceType<typeof duckdb.Database>;

let databaseAccessQueue: Promise<unknown> = Promise.resolve();

function runSerializedDatabaseTask<T>(task: () => Promise<T>): Promise<T> {
	const runTask = () => withInterprocessLock(databaseLockPath, task);
	const run = databaseAccessQueue.then(runTask, runTask);
	databaseAccessQueue = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

export function openDatabase(accessMode: 'READ_ONLY' | 'READ_WRITE' = 'READ_ONLY'): Promise<DB> {
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

export function runWithExclusiveDatabaseAccess<T>(task: () => Promise<T>): Promise<T> {
	return runSerializedDatabaseTask(task);
}

export function withDatabase<T>(
	task: (db: DB) => Promise<T>,
	accessMode: 'READ_ONLY' | 'READ_WRITE' = 'READ_ONLY'
): Promise<T> {
	return runSerializedDatabaseTask(async () => {
		const db = await openDatabase(accessMode);
		try {
			return await task(db);
		} finally {
			await closeDatabase(db);
		}
	});
}

export function queryAll<T>(db: DB, sql: string, params: unknown[] = []): Promise<T[]> {
	return new Promise((resolveRows, reject) => {
		const callback = (err: Error | null, rows: unknown[]) => {
			if (err) {
				reject(err);
				return;
			}

			resolveRows(rows as T[]);
		};

		if (params.length === 0) {
			db.all(sql, callback);
			return;
		}

		db.all(sql, params, callback);
	});
}

export async function queryOne<T>(db: DB, sql: string, params: unknown[] = []): Promise<T | null> {
	const rows = await queryAll<T>(db, sql, params);
	return rows[0] ?? null;
}

export function closeDatabase(db: DB): Promise<void> {
	return new Promise((resolveClose) => db.close(() => resolveClose()));
}
