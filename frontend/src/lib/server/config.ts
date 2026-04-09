import { resolve } from 'node:path';

import { buildLocationKey, buildLocationLabel, type LocationSeed } from '@/lib/weather';

const defaultHistoryStartDate = '2020-01-01';

function isoCalendarDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function resolveHistoryStartDate(): string {
	const value = process.env.WEATHER_LEDGER_HISTORY_START ?? defaultHistoryStartDate;
	const parsedDate = new Date(value);
	if (Number.isNaN(parsedDate.getTime())) {
		throw new Error(
			`WEATHER_LEDGER_HISTORY_START must be a valid date string. Received ${JSON.stringify(value)}.`
		);
	}

	return isoCalendarDate(parsedDate);
}

export const historyStartDate = resolveHistoryStartDate();

function parseCoordinate(
	environmentVariable: string,
	rawValue: string,
	minimum: number,
	maximum: number
): number {
	const value = Number(rawValue);
	if (!Number.isFinite(value)) {
		throw new Error(
			`${environmentVariable} must be a finite number. Received ${JSON.stringify(rawValue)}.`
		);
	}
	if (value < minimum || value > maximum) {
		throw new Error(
			`${environmentVariable} must be between ${minimum} and ${maximum}. Received ${value}.`
		);
	}

	return value;
}

export function resolveSQLitePath(): string {
	return (
		process.env.WEATHER_LEDGER_SQLITE_PATH ?? resolve(process.cwd(), '../database/weather.sqlite3')
	);
}

export function defaultLocation(): LocationSeed {
	const name = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_NAME ?? 'Fort Collins';
	const admin1 = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_ADMIN1 ?? 'Colorado';
	const country = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_COUNTRY ?? 'United States';
	const latitude = parseCoordinate(
		'WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE',
		process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE ?? '40.5852',
		-90,
		90
	);
	const longitude = parseCoordinate(
		'WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE',
		process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE ?? '-105.0844',
		-180,
		180
	);
	const timezone = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_TIMEZONE ?? 'America/Denver';

	return {
		locationKey:
			process.env.WEATHER_LEDGER_DEFAULT_LOCATION_KEY ??
			buildLocationKey({ name, admin1, country, latitude, longitude }),
		displayName: buildLocationLabel({ name, admin1, country }),
		name,
		admin1,
		country,
		latitude,
		longitude,
		timezone
	};
}
