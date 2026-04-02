import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { defaultLocation } from '$lib/server/config';
import {
	databasePath,
	queryOne,
	runWithExclusiveDatabaseAccess,
	withDatabase
} from '$lib/server/database';

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

const dataPipelineDir = resolve(process.cwd(), '../data-pipeline');
const defaultCommandTimeoutMs = 60_000;
const dbtCommandTimeoutMs = 120_000;
const forcedKillDelayMs = 5_000;
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

function logRebuildFailure(location: FetchResult, cause: unknown): void {
	const detail = normalizeCommandErrorDetail(cause);
	console.error(
		`[location-pipeline] dbt rebuild failed after caching ${location.locationKey} (${location.canonicalName}).\n${detail}`
	);
}

function logFetchFailure(cause: unknown): void {
	const detail = normalizeCommandErrorDetail(cause);
	console.error(`[location-pipeline] fetch pipeline failed.\n${detail}`);
}

function publicPipelineError(cause: unknown): LocationPipelineError {
	const detail = normalizeCommandErrorDetail(cause);

	if (detail.includes('Could not set lock on file')) {
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
	const run = pipelineQueue.then(task, task);
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
		DBT_DUCKDB_PATH: databasePath
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

function runCommand(
	command: string,
	args: string[],
	timeoutMs = defaultCommandTimeoutMs
): Promise<string> {
	return new Promise((resolveOutput, reject) => {
		const child = spawn(command, args, {
			cwd: dataPipelineDir,
			env: pipelineEnvironment(),
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

async function rebuildMarts(): Promise<void> {
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
		dbtCommandTimeoutMs
	);
}

async function fetchAndRebuild(fetchArgs: string[]): Promise<FetchResult> {
	const result = await runFetch(fetchArgs);

	try {
		await rebuildMarts();
		return result;
	} catch (error) {
		logRebuildFailure(result, error);
		throw new PipelineRebuildError(result);
	}
}

export function ensureDefaultLocationData(): Promise<FetchResult> {
	return runQueued(async () => {
		return runWithExclusiveDatabaseAccess(async () => {
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

		return runWithExclusiveDatabaseAccess(async () => {
			return fetchAndRebuild(['--latitude', String(latitude), '--longitude', String(longitude)]);
		});
	});
}
