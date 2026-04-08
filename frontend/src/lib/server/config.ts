import { resolve } from 'node:path';

import { buildLocationKey, buildLocationLabel, type LocationSeed } from '@/lib/weather';

export const historyStartDate = process.env.WEATHER_LEDGER_HISTORY_START ?? '2020-01-01';

export function resolveSQLitePath(): string {
	return (
		process.env.WEATHER_LEDGER_SQLITE_PATH ?? resolve(process.cwd(), '../database/weather.sqlite3')
	);
}

export function defaultLocation(): LocationSeed {
	const name = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_NAME ?? 'Fort Collins';
	const admin1 = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_ADMIN1 ?? 'Colorado';
	const country = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_COUNTRY ?? 'United States';
	const latitude = Number(process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE ?? '40.5852');
	const longitude = Number(process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE ?? '-105.0844');
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
