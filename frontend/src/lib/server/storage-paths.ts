import { parse, resolve } from 'node:path';

export function deriveLedgerPath(snapshotPath: string): string {
	const parsed = parse(snapshotPath);
	if (parsed.ext === '') {
		return `${snapshotPath}.sqlite3`;
	}

	return resolve(parsed.dir, `${parsed.name}.sqlite3`);
}

export function deriveJobQueuePath(snapshotPath: string): string {
	const parsed = parse(snapshotPath);
	if (parsed.ext === '') {
		return `${snapshotPath}.jobs.sqlite3`;
	}

	return resolve(parsed.dir, `${parsed.name}.jobs.sqlite3`);
}

export const databasePath =
	process.env.WEATHER_LEDGER_DB_PATH ?? resolve(process.cwd(), '../database/weather.duckdb');

export const ledgerPath = process.env.WEATHER_LEDGER_LEDGER_PATH ?? deriveLedgerPath(databasePath);

export const locationJobQueuePath =
	process.env.WEATHER_LEDGER_JOB_DB_PATH ?? deriveJobQueuePath(databasePath);
