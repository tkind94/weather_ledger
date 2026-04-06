import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

import { defaultLocation } from '$lib/server/config';
import {
	claimQueuedLocationJobs,
	createLocationJob,
	getLocationJob as loadLocationJob,
	hasQueuedLocationJobs,
	markLocationJobFailed,
	markLocationJobSucceeded,
	recordLocationJobFetchResult,
	type LocationJob,
	type LocationJobLocation
} from '$lib/server/location-job-store';
import { queryOne, withDatabase } from '$lib/server/database';
import { withInterprocessLock } from '$lib/server/interprocess-lock';
import { databasePath, ledgerPath } from '$lib/server/storage-paths';

type FetchResult = {
	locationKey: string;
	canonicalName: string;
	latitude: number;
	longitude: number;
	timezone: string;
	rowsStored: number;
	startDate: string | null;
	endDate: string | null;
	existingLocation: boolean;
};

export type {
	LocationJob,
	LocationJobLocation,
	LocationJobStatus
} from '$lib/server/location-job-store';

const dataPipelineDir = resolve(process.cwd(), '../data-pipeline');
const defaultCommandTimeoutMs = 60_000;
const dbtCommandTimeoutMs = 120_000;
const forcedKillDelayMs = 5_000;
const pipelineLockPath = `${databasePath}.pipeline.lock`;
// eslint-disable-next-line no-control-regex
const ansiEscapePattern = /\u001B\[[0-?]*[ -/]*[@-~]|\u009B[0-?]*[ -/]*[@-~]/g;
const testLocationOverrideQuery = `
	SELECT
		location_key AS locationKey,
		canonical_name AS canonicalName,
		latitude,
		longitude,
		timezone
	FROM location_catalog
	WHERE location_key = ?
`;

let pipelineQueue: Promise<unknown> = Promise.resolve();
let locationJobProcessor: Promise<void> | null = null;

export class PipelineRebuildError extends Error {
	readonly location: FetchResult;
	readonly userMessage: string;

	constructor(location: FetchResult) {
		const userMessage =
			location.rowsStored > 0
				? `Cached ${location.rowsStored} new daily observations for ${location.canonicalName}, but the dashboard rebuild failed. Retry the request.`
				: `${location.canonicalName} is already up to date, but the dashboard rebuild failed. Retry the request.`;
		super(userMessage);
		this.name = 'PipelineRebuildError';
		this.location = location;
		this.userMessage = userMessage;
	}
}

export class LocationPipelineError extends Error {
	readonly userMessage: string;
	readonly statusCode: number;

	constructor(userMessage: string, statusCode: number) {
		super(userMessage);
		this.name = 'LocationPipelineError';
		this.userMessage = userMessage;
		this.statusCode = statusCode;
	}
}

function normalizeCommandErrorDetail(cause: unknown): string {
	if (!(cause instanceof Error)) {
		return 'Unknown dbt error';
	}

	const normalized = cause.message.replace(ansiEscapePattern, '').trim();
	return normalized === '' ? 'Unknown dbt error' : normalized;
}

function logRebuildFailure(locations: FetchResult[], cause: unknown): void {
	const detail = normalizeCommandErrorDetail(cause);
	const locationSummary = locations
		.map((location) => `${location.locationKey} (${location.canonicalName})`)
		.join(', ');
	console.error(
		`[location-pipeline] dbt rebuild failed after caching ${locationSummary}.\n${detail}`
	);
}

function logFetchFailure(cause: unknown): void {
	const detail = normalizeCommandErrorDetail(cause);
	console.error(`[location-pipeline] fetch pipeline failed.\n${detail}`);
}

function publicPipelineError(cause: unknown): LocationPipelineError {
	const detail = normalizeCommandErrorDetail(cause);

	if (
		detail.includes('Could not set lock on file') ||
		detail.includes('database is locked') ||
		detail.includes('Timed out waiting for lock')
	) {
		return new LocationPipelineError(
			'The local weather database is busy. Retry the request in a moment.',
			503
		);
	}

	if (
		detail.includes('Forward geocoding did not return any matching locations') ||
		detail.includes('could not determine a common place name') ||
		detail.includes('Reverse geocoding could not determine')
	) {
		return new LocationPipelineError(
			'Could not resolve that map point to a supported location. Try clicking closer to a city.',
			400
		);
	}

	return new LocationPipelineError(
		'Unable to load that location right now. Retry the request.',
		502
	);
}

function runQueued<T>(task: () => Promise<T>): Promise<T> {
	const runTask = () => withInterprocessLock(pipelineLockPath, task);
	const run = pipelineQueue.then(runTask, runTask);
	pipelineQueue = run.then(
		() => undefined,
		() => undefined
	);
	return run;
}

function pipelineEnvironment(): NodeJS.ProcessEnv {
	return {
		...process.env,
		WEATHER_LEDGER_DB_PATH: databasePath,
		WEATHER_LEDGER_LEDGER_PATH: ledgerPath
	};
}

function locationJobLocation(result: FetchResult): LocationJobLocation {
	return {
		locationKey: result.locationKey,
		canonicalName: result.canonicalName,
		rowsStored: result.rowsStored,
		existingLocation: result.existingLocation
	};
}

function testMapLocationOverrideKey(): string | null {
	return process.env.WEATHER_LEDGER_TEST_MAP_LOCATION_KEY?.trim() || null;
}

async function loadTestLocationOverride(locationKey: string): Promise<FetchResult> {
	return withDatabase(async (db) => {
		const location = await queryOne<{
			locationKey: string;
			canonicalName: string;
			latitude: number;
			longitude: number;
			timezone: string;
		}>(db, testLocationOverrideQuery, [locationKey]);

		if (location === null) {
			throw new Error(
				`WEATHER_LEDGER_TEST_MAP_LOCATION_KEY references unknown seeded location: ${locationKey}`
			);
		}

		return {
			locationKey: location.locationKey,
			canonicalName: location.canonicalName,
			latitude: location.latitude,
			longitude: location.longitude,
			timezone: location.timezone,
			rowsStored: 0,
			startDate: null,
			endDate: null,
			existingLocation: true
		};
	});
}

function skipsSnapshotRebuild(): boolean {
	return testMapLocationOverrideKey() !== null;
}

function runCommand(
	command: string,
	args: string[],
	options: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<string> {
	const timeoutMs = options.timeoutMs ?? defaultCommandTimeoutMs;
	const environment = {
		...pipelineEnvironment(),
		...options.env
	};

	return new Promise((resolveOutput, reject) => {
		const child = spawn(command, args, {
			cwd: dataPipelineDir,
			env: environment,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let settled = false;
		let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

		const timeoutTimer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGTERM');
			forceKillTimer = setTimeout(() => {
				child.kill('SIGKILL');
			}, forcedKillDelayMs);
		}, timeoutMs);

		function cleanup(): void {
			clearTimeout(timeoutTimer);
			if (forceKillTimer) {
				clearTimeout(forceKillTimer);
			}
		}

		function finish(callback: () => void): void {
			if (settled) {
				return;
			}

			settled = true;
			cleanup();
			callback();
		}

		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			finish(() => reject(error));
		});
		child.on('close', (code, signal) => {
			finish(() => {
				const output = stderr.trim() || stdout.trim();

				if (timedOut) {
					reject(
						new Error(
							`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}${output ? `\n${output}` : ''}`
						)
					);
					return;
				}

				if (code === 0) {
					resolveOutput(stdout.trim());
					return;
				}

				reject(new Error(output || `${command} exited with ${signal ?? code}`));
			});
		});
	});
}

async function runFetch(args: string[]): Promise<FetchResult> {
	try {
		const stdout = await runCommand('uv', ['run', 'python', 'fetch.py', '--json', ...args]);
		return JSON.parse(stdout) as FetchResult;
	} catch (error) {
		logFetchFailure(error);
		throw publicPipelineError(error);
	}
}

async function fetchLocationFromCoordinates(
	latitude: number,
	longitude: number
): Promise<FetchResult> {
	const locationKey = testMapLocationOverrideKey();
	if (locationKey !== null) {
		return loadTestLocationOverride(locationKey);
	}

	return runFetch(['--latitude', String(latitude), '--longitude', String(longitude)]);
}

function snapshotBuildPath(): string {
	const snapshotStem = basename(databasePath, '.duckdb').replace(/[^A-Za-z0-9_]/g, '_');
	const uniqueSuffix = randomUUID().replace(/-/g, '');
	return resolve(
		dirname(databasePath),
		`${snapshotStem}_tmp_${process.pid}_${uniqueSuffix}.duckdb`
	);
}

async function prepareSnapshot(snapshotPath: string): Promise<void> {
	await mkdir(dirname(snapshotPath), { recursive: true });
	await runCommand('uv', ['run', 'python', 'build_snapshot.py', '--output-path', snapshotPath]);
}

async function rebuildMarts(snapshotPath: string): Promise<void> {
	await runCommand(
		'uv',
		[
			'run',
			'dbt',
			'build',
			'--profiles-dir',
			'.dbt',
			'--select',
			'weather_daily_history',
			'location_catalog',
			'weather_monthly_extremes',
			'dashboard_summary'
		],
		{
			timeoutMs: dbtCommandTimeoutMs,
			env: {
				DBT_DUCKDB_PATH: snapshotPath
			}
		}
	);
}

async function publishSnapshot(snapshotPath: string): Promise<void> {
	await rename(snapshotPath, databasePath);
}

async function cleanupSnapshot(snapshotPath: string): Promise<void> {
	await rm(snapshotPath, { force: true });
}

async function rebuildPublishedSnapshot(): Promise<void> {
	if (skipsSnapshotRebuild()) {
		return;
	}

	const snapshotPath = snapshotBuildPath();

	try {
		await prepareSnapshot(snapshotPath);
		await rebuildMarts(snapshotPath);
		await publishSnapshot(snapshotPath);
	} catch (error) {
		await cleanupSnapshot(snapshotPath);
		throw error;
	}
}

async function fetchAndRebuild(fetchArgs: string[]): Promise<FetchResult> {
	const result = await runFetch(fetchArgs);

	try {
		await rebuildPublishedSnapshot();
		return result;
	} catch (error) {
		logRebuildFailure([result], error);
		throw new PipelineRebuildError(result);
	}
}

async function drainQueuedLocationJobs(): Promise<void> {
	const fetchedJobs: Array<{ jobId: string; result: FetchResult }> = [];

	while (true) {
		const jobs = claimQueuedLocationJobs();
		if (jobs.length === 0) {
			break;
		}

		for (const job of jobs) {
			try {
				const result = await fetchLocationFromCoordinates(job.latitude, job.longitude);
				recordLocationJobFetchResult(job.jobId, locationJobLocation(result));
				fetchedJobs.push({ jobId: job.jobId, result });
			} catch (error) {
				logFetchFailure(error);
				const failure = error instanceof LocationPipelineError ? error : publicPipelineError(error);
				markLocationJobFailed(job.jobId, { message: failure.userMessage });
			}
		}
	}

	if (fetchedJobs.length === 0) {
		return;
	}

	if (skipsSnapshotRebuild()) {
		for (const job of fetchedJobs) {
			markLocationJobSucceeded(job.jobId, locationJobLocation(job.result));
		}
		return;
	}

	try {
		await rebuildPublishedSnapshot();
		for (const job of fetchedJobs) {
			markLocationJobSucceeded(job.jobId, locationJobLocation(job.result));
		}
	} catch (error) {
		logRebuildFailure(
			fetchedJobs.map((job) => job.result),
			error
		);

		for (const job of fetchedJobs) {
			markLocationJobFailed(job.jobId, {
				location: locationJobLocation(job.result),
				message: new PipelineRebuildError(job.result).userMessage,
				partialSuccess: true
			});
		}
	}
}

function scheduleLocationJobProcessor(): void {
	if (locationJobProcessor !== null) {
		return;
	}

	locationJobProcessor = runQueued(async () => {
		await drainQueuedLocationJobs();
	})
		.catch((error) => {
			console.error(
				`[location-pipeline] background location queue failed.\n${normalizeCommandErrorDetail(error)}`
			);
		})
		.finally(() => {
			locationJobProcessor = null;
			if (hasQueuedLocationJobs()) {
				scheduleLocationJobProcessor();
			}
		});
}

export function ensureDefaultLocationData(): Promise<FetchResult> {
	return runQueued(async () => {
		return fetchAndRebuild([
			'--latitude',
			defaultLocation.latitude,
			'--longitude',
			defaultLocation.longitude,
			'--location-key',
			defaultLocation.key,
			'--location-name',
			defaultLocation.name,
			'--timezone',
			defaultLocation.timezone
		]);
	});
}

export function ensureLocationFromCoordinates(
	latitude: number,
	longitude: number
): Promise<FetchResult> {
	return runQueued(async () => {
		const locationKey = testMapLocationOverrideKey();
		if (locationKey !== null) {
			return loadTestLocationOverride(locationKey);
		}

		return fetchAndRebuild(['--latitude', String(latitude), '--longitude', String(longitude)]);
	});
}

export async function enqueueLocationJob(
	latitude: number,
	longitude: number
): Promise<LocationJob> {
	const job = createLocationJob(latitude, longitude);
	scheduleLocationJobProcessor();
	return job;
}

export async function getLocationJob(jobId: string): Promise<LocationJob | null> {
	return loadLocationJob(jobId);
}
