import { createRequire } from 'node:module';

import { databasePath } from './storage-paths';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

type DB = InstanceType<typeof duckdb.Database>;

let databaseWriteQueue: Promise<unknown> = Promise.resolve();

function runSerializedWriteTask<T>(task: () => Promise<T>): Promise<T> {
	const run = databaseWriteQueue.then(task, task);
	databaseWriteQueue = run.then(
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
	return runSerializedWriteTask(task);
}

export function withDatabase<T>(
	task: (db: DB) => Promise<T>,
	accessMode: 'READ_ONLY' | 'READ_WRITE' = 'READ_ONLY'
): Promise<T> {
	const runTask = async () => {
		const db = await openDatabase(accessMode);
		try {
			return await task(db);
		} finally {
			await closeDatabase(db);
		}
	};

	if (accessMode === 'READ_ONLY') {
		return runTask();
	}

	return runSerializedWriteTask(runTask);
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
