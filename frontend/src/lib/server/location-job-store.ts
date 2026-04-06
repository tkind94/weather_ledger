import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

import { locationJobQueuePath } from './storage-paths';

export type LocationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type LocationJobLocation = {
	locationKey: string;
	canonicalName: string;
	rowsStored: number;
	existingLocation: boolean;
};

export type LocationJob = {
	jobId: string;
	latitude: number;
	longitude: number;
	status: LocationJobStatus;
	createdAt: string;
	updatedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	location: LocationJobLocation | null;
	message: string | null;
	partialSuccess: boolean;
};

type LocationJobRow = {
	jobId: string;
	latitude: number;
	longitude: number;
	status: LocationJobStatus;
	createdAt: string;
	updatedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	locationKey: string | null;
	canonicalName: string | null;
	rowsStored: number | null;
	existingLocation: number | null;
	message: string | null;
	partialSuccess: number;
};

type LocationJobFailure = {
	message: string;
	partialSuccess?: boolean;
	location?: LocationJobLocation;
};

type SqliteStatement = {
	get(...params: unknown[]): unknown;
	all(...params: unknown[]): unknown[];
	run(...params: unknown[]): void;
};

type SqliteDatabase = {
	exec(sql: string): void;
	prepare(sql: string): SqliteStatement;
	close(): void;
};

type SqliteDatabaseConstructor = new (filename: string) => SqliteDatabase;

const require = createRequire(import.meta.url);
const sqliteModule = (
	'Bun' in globalThis
		? (require('bun:sqlite') as { Database: SqliteDatabaseConstructor })
		: (require('node:sqlite') as { DatabaseSync: SqliteDatabaseConstructor })
) as { Database: SqliteDatabaseConstructor } | { DatabaseSync: SqliteDatabaseConstructor };
const SQLiteDatabase =
	'Database' in sqliteModule ? sqliteModule.Database : sqliteModule.DatabaseSync;

const schemaSql = `
	CREATE TABLE IF NOT EXISTS location_jobs (
		job_id TEXT PRIMARY KEY,
		latitude REAL NOT NULL,
		longitude REAL NOT NULL,
		status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		started_at TEXT,
		finished_at TEXT,
		location_key TEXT,
		canonical_name TEXT,
		rows_stored INTEGER,
		existing_location INTEGER,
		message TEXT,
		partial_success INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS location_jobs_status_created_at_idx
		ON location_jobs(status, created_at);
`;

function withTransaction<T>(database: SqliteDatabase, task: () => T): T {
	database.exec('BEGIN IMMEDIATE');

	try {
		const result = task();
		database.exec('COMMIT');
		return result;
	} catch (error) {
		try {
			database.exec('ROLLBACK');
		} catch {
			// Keep the original error.
		}

		throw error;
	}
}

function withLocationJobDatabase<T>(task: (database: SqliteDatabase) => T): T {
	mkdirSync(dirname(locationJobQueuePath), { recursive: true });
	const database = new SQLiteDatabase(locationJobQueuePath);
	database.exec('PRAGMA journal_mode = WAL');
	database.exec('PRAGMA busy_timeout = 5000');
	database.exec(schemaSql);

	try {
		return task(database);
	} finally {
		database.close();
	}
}

function rowToLocationJob(row: LocationJobRow): LocationJob {
	return {
		jobId: row.jobId,
		latitude: row.latitude,
		longitude: row.longitude,
		status: row.status,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt,
		location:
			row.locationKey === null || row.canonicalName === null
				? null
				: {
						locationKey: row.locationKey,
						canonicalName: row.canonicalName,
						rowsStored: row.rowsStored ?? 0,
						existingLocation: row.existingLocation === 1
					},
		message: row.message,
		partialSuccess: row.partialSuccess === 1
	};
}

export function createLocationJob(latitude: number, longitude: number): LocationJob {
	return withLocationJobDatabase((database) => {
		const now = new Date().toISOString();
		const jobId = randomUUID();
		database
			.prepare(
				`INSERT INTO location_jobs (
					job_id,
					latitude,
					longitude,
					status,
					created_at,
					updated_at,
					partial_success
				) VALUES (?, ?, ?, 'queued', ?, ?, 0)`
			)
			.run(jobId, latitude, longitude, now, now);

		return rowToLocationJob({
			jobId,
			latitude,
			longitude,
			status: 'queued',
			createdAt: now,
			updatedAt: now,
			startedAt: null,
			finishedAt: null,
			locationKey: null,
			canonicalName: null,
			rowsStored: null,
			existingLocation: null,
			message: null,
			partialSuccess: 0
		});
	});
}

export function getLocationJob(jobId: string): LocationJob | null {
	return withLocationJobDatabase((database) => {
		const row = database
			.prepare(
				`SELECT
					job_id AS jobId,
					latitude,
					longitude,
					status,
					created_at AS createdAt,
					updated_at AS updatedAt,
					started_at AS startedAt,
					finished_at AS finishedAt,
					location_key AS locationKey,
					canonical_name AS canonicalName,
					rows_stored AS rowsStored,
					existing_location AS existingLocation,
					message,
					partial_success AS partialSuccess
				FROM location_jobs
				WHERE job_id = ?`
			)
			.get(jobId) as LocationJobRow | undefined;

		return row ? rowToLocationJob(row) : null;
	});
}

export function claimQueuedLocationJobs(limit = 8): LocationJob[] {
	return withLocationJobDatabase((database) => {
		const selectQueued = database.prepare(
			`SELECT
				job_id AS jobId,
				latitude,
				longitude,
				status,
				created_at AS createdAt,
				updated_at AS updatedAt,
				started_at AS startedAt,
				finished_at AS finishedAt,
				location_key AS locationKey,
				canonical_name AS canonicalName,
				rows_stored AS rowsStored,
				existing_location AS existingLocation,
				message,
				partial_success AS partialSuccess
			FROM location_jobs
			WHERE status = 'queued'
			ORDER BY created_at ASC
			LIMIT ?`
		);
		const updateRunning = database.prepare(
			`UPDATE location_jobs
			SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?, message = NULL, partial_success = 0
			WHERE job_id = ?`
		);

		return withTransaction(database, () => {
			const now = new Date().toISOString();
			const rows = selectQueued.all(limit) as unknown as LocationJobRow[];
			for (const row of rows) {
				updateRunning.run(now, now, row.jobId);
			}

			return rows.map((row) =>
				rowToLocationJob({
					...row,
					status: 'running',
					startedAt: row.startedAt ?? now,
					updatedAt: now,
					message: null,
					partialSuccess: 0
				})
			);
		});
	});
}

export function hasQueuedLocationJobs(): boolean {
	return withLocationJobDatabase((database) => {
		const row = database
			.prepare(
				`SELECT CAST(COUNT(*) AS INTEGER) AS queuedCount
				FROM location_jobs
				WHERE status = 'queued'`
			)
			.get() as { queuedCount: number } | undefined;

		return (row?.queuedCount ?? 0) > 0;
	});
}

export function recordLocationJobFetchResult(jobId: string, location: LocationJobLocation): void {
	withLocationJobDatabase((database) => {
		database
			.prepare(
				`UPDATE location_jobs
				SET location_key = ?,
					canonical_name = ?,
					rows_stored = ?,
					existing_location = ?,
					updated_at = ?
				WHERE job_id = ?`
			)
			.run(
				location.locationKey,
				location.canonicalName,
				location.rowsStored,
				location.existingLocation ? 1 : 0,
				new Date().toISOString(),
				jobId
			);
	});
}

export function markLocationJobSucceeded(jobId: string, location: LocationJobLocation): void {
	withLocationJobDatabase((database) => {
		const now = new Date().toISOString();
		database
			.prepare(
				`UPDATE location_jobs
				SET status = 'succeeded',
					finished_at = ?,
					updated_at = ?,
					location_key = ?,
					canonical_name = ?,
					rows_stored = ?,
					existing_location = ?,
					message = NULL,
					partial_success = 0
				WHERE job_id = ?`
			)
			.run(
				now,
				now,
				location.locationKey,
				location.canonicalName,
				location.rowsStored,
				location.existingLocation ? 1 : 0,
				jobId
			);
	});
}

export function markLocationJobFailed(jobId: string, failure: LocationJobFailure): void {
	withLocationJobDatabase((database) => {
		const now = new Date().toISOString();
		database
			.prepare(
				`UPDATE location_jobs
				SET status = 'failed',
					finished_at = ?,
					updated_at = ?,
					location_key = ?,
					canonical_name = ?,
					rows_stored = ?,
					existing_location = ?,
					message = ?,
					partial_success = ?
				WHERE job_id = ?`
			)
			.run(
				now,
				now,
				failure.location?.locationKey ?? null,
				failure.location?.canonicalName ?? null,
				failure.location?.rowsStored ?? null,
				failure.location ? (failure.location.existingLocation ? 1 : 0) : null,
				failure.message,
				failure.partialSuccess === true ? 1 : 0,
				jobId
			);
	});
}
