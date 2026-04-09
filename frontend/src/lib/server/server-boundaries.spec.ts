import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('server-only', () => ({}));

type StoredLocation = {
	locationKey: string;
	displayName: string;
	name: string;
	admin1: string | null;
	country: string | null;
	latitude: number;
	longitude: number;
	timezone: string;
	lastFetchedAt: string;
};

type StoredObservation = {
	locationKey: string;
	weatherDate: string;
	maxTemperature: number;
	minTemperature: number;
	precipitation: number;
};

const sqliteState = {
	locations: new Map<string, StoredLocation>(),
	observations: new Map<string, StoredObservation[]>()
};

function resetSqliteState(): void {
	sqliteState.locations.clear();
	sqliteState.observations.clear();
}

function sortedObservations(locationKey: string): StoredObservation[] {
	return [...(sqliteState.observations.get(locationKey) ?? [])].sort((left, right) =>
		left.weatherDate.localeCompare(right.weatherDate)
	);
}

function locationRows(filter?: {
	locationKey?: string;
	latitude?: number;
	longitude?: number;
}): Array<
	StoredLocation & {
		observationCount: number;
		firstObservationDate: string | null;
		latestObservationDate: string | null;
	}
> {
	return [...sqliteState.locations.values()]
		.filter((location) => {
			if (filter?.locationKey && location.locationKey !== filter.locationKey) {
				return false;
			}
			if (
				filter?.latitude !== undefined &&
				filter?.longitude !== undefined &&
				(location.latitude !== filter.latitude || location.longitude !== filter.longitude)
			) {
				return false;
			}

			return true;
		})
		.map((location) => {
			const observations = sortedObservations(location.locationKey);
			return {
				...location,
				observationCount: observations.length,
				firstObservationDate: observations[0]?.weatherDate ?? null,
				latestObservationDate: observations.at(-1)?.weatherDate ?? null
			};
		})
		.sort((left, right) => {
			const fetchedAtOrder = right.lastFetchedAt.localeCompare(left.lastFetchedAt);
			if (fetchedAtOrder !== 0) {
				return fetchedAtOrder;
			}

			return (
				left.name.localeCompare(right.name) ||
				(left.admin1 ?? '').localeCompare(right.admin1 ?? '') ||
				(left.country ?? '').localeCompare(right.country ?? '')
			);
		});
}

const sqlitePrepare = mock((sql: string) => {
	if (sql.includes('INSERT INTO locations')) {
		return {
			run: (...args: unknown[]) => {
				const [
					locationKey,
					displayName,
					name,
					admin1,
					country,
					latitude,
					longitude,
					timezone,
					fetchedAt
				] = args as [
					string,
					string,
					string,
					string | null,
					string | null,
					number,
					number,
					string,
					string
				];

				sqliteState.locations.set(locationKey, {
					locationKey,
					displayName,
					name,
					admin1,
					country,
					latitude,
					longitude,
					timezone,
					lastFetchedAt: fetchedAt
				});
			}
		};
	}

	if (sql.includes('INSERT INTO daily_weather')) {
		return {
			run: (...args: unknown[]) => {
				const [locationKey, weatherDate, maxTemperature, minTemperature, precipitation] = args as [
					string,
					string,
					number,
					number,
					number
				];
				const existingObservations = sqliteState.observations.get(locationKey) ?? [];
				const nextObservations = existingObservations.filter(
					(observation) => observation.weatherDate !== weatherDate
				);
				nextObservations.push({
					locationKey,
					weatherDate,
					maxTemperature,
					minTemperature,
					precipitation
				});
				sqliteState.observations.set(locationKey, nextObservations);
			}
		};
	}

	if (sql.includes('SELECT MAX(observation_date) AS latestObservationDate FROM daily_weather')) {
		return {
			get: (locationKey: string) => ({
				latestObservationDate: sortedObservations(locationKey).at(-1)?.weatherDate ?? null
			})
		};
	}

	if (sql.includes('FROM daily_weather') && sql.includes('ORDER BY observation_date ASC')) {
		return {
			all: (locationKey: string) =>
				sortedObservations(locationKey).map((observation) => ({
					weatherDate: observation.weatherDate,
					maxTemperature: observation.maxTemperature,
					minTemperature: observation.minTemperature,
					precipitation: observation.precipitation
				}))
		};
	}

	if (sql.includes('FROM locations l') && sql.includes('GROUP BY l.location_key')) {
		return {
			all: (...args: unknown[]) => {
				if (sql.includes('WHERE l.location_key = ?')) {
					return locationRows({ locationKey: args[0] as string });
				}

				if (sql.includes('WHERE ROUND(l.latitude, 4) = ? AND ROUND(l.longitude, 4) = ?')) {
					return locationRows({
						latitude: args[0] as number,
						longitude: args[1] as number
					});
				}

				return locationRows();
			}
		};
	}

	throw new Error(`Unhandled SQL in server-boundaries.spec.ts: ${sql}`);
});

mock.module('@/lib/server/sqlite', () => ({
	getDatabase: () => ({
		prepare: sqlitePrepare,
		transaction:
			<T extends (...args: never[]) => void>(callback: T) =>
			(...args: Parameters<T>): ReturnType<T> =>
				callback(...args)
	})
}));

const configModule = import('./config');
const openMeteoModule = import('./open-meteo');

const originalHistoryStart = process.env.WEATHER_LEDGER_HISTORY_START;
const originalLatitude = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE;
const originalLongitude = process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE;
const originalFetch = globalThis.fetch;

function restoreEnvironment(
	name:
		| 'WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE'
		| 'WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE'
		| 'WEATHER_LEDGER_HISTORY_START',
	value: string | undefined
): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}

	process.env[name] = value;
}

afterEach(() => {
	restoreEnvironment('WEATHER_LEDGER_HISTORY_START', originalHistoryStart);
	restoreEnvironment('WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE', originalLatitude);
	restoreEnvironment('WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE', originalLongitude);
	resetSqliteState();
	globalThis.fetch = originalFetch;
	mock.clearAllMocks();
});

describe('observationsFromArchiveDaily', () => {
	test('skips days with missing temperatures and keeps missing precipitation at zero', async () => {
		const { observationsFromArchiveDaily } = await openMeteoModule;

		expect(
			observationsFromArchiveDaily({
				time: ['2026-04-01', '2026-04-02', '2026-04-03'],
				temperature_2m_max: [18, null, 21],
				temperature_2m_min: [5, 7, null],
				precipitation_sum: [null, 1.5, null]
			})
		).toEqual([
			{
				weatherDate: '2026-04-01',
				maxTemperature: 18,
				minTemperature: 5,
				precipitation: 0
			}
		]);
	});

	test('throws when the archive payload omits daily observations', async () => {
		const { observationsFromArchiveResponse } = await openMeteoModule;

		expect(() => observationsFromArchiveResponse({})).toThrow(
			/Open-Meteo archive response did not include daily observations/
		);
	});
});

describe('resolveHistoryStartDate', () => {
	test('keeps YYYY-MM-DD inputs unchanged', async () => {
		const { resolveHistoryStartDate } = await configModule;

		process.env.WEATHER_LEDGER_HISTORY_START = '2020-01-01';

		expect(resolveHistoryStartDate()).toBe('2020-01-01');
	});

	test('normalizes date-times to YYYY-MM-DD', async () => {
		const { resolveHistoryStartDate } = await configModule;

		process.env.WEATHER_LEDGER_HISTORY_START = '2020-01-01T00:00:00Z';

		expect(resolveHistoryStartDate()).toBe('2020-01-01');
	});

	test('throws when history start is not a valid date', async () => {
		const { resolveHistoryStartDate } = await configModule;

		process.env.WEATHER_LEDGER_HISTORY_START = 'not-a-date';

		expect(() => resolveHistoryStartDate()).toThrow(
			/WEATHER_LEDGER_HISTORY_START must be a valid date string/
		);
	});
});

describe('defaultLocation', () => {
	test('throws when latitude is not finite', async () => {
		const { defaultLocation } = await configModule;

		process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE = 'north';

		expect(() => defaultLocation()).toThrow(
			/WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE must be a finite number/
		);
	});

	test('throws when longitude is out of range', async () => {
		const { defaultLocation } = await configModule;

		process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE = '-181';

		expect(() => defaultLocation()).toThrow(
			/WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE must be between -180 and 180/
		);
	});
});

describe('loadDashboard', () => {
	test('seeds the default location on the first request, then reads without writing again', async () => {
		const fetchMock = mock(async (input: RequestInfo | URL) => {
			const url = new URL(typeof input === 'string' ? input : input.toString());
			expect(url.searchParams.get('start_date')).toBe('2020-01-01');
			expect(url.searchParams.get('end_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);

			return new Response(
				JSON.stringify({
					daily: {
						time: ['2020-01-01', '2020-01-02'],
						temperature_2m_max: [12, 14],
						temperature_2m_min: [2, 4],
						precipitation_sum: [1.5, 0]
					}
				}),
				{
					status: 200,
					headers: { 'content-type': 'application/json' }
				}
			);
		});
		globalThis.fetch = fetchMock as typeof fetch;

		const { loadDashboard } = await import('./weather');
		const firstLoad = await loadDashboard();
		const secondLoad = await loadDashboard();

		expect(firstLoad.cachedLocations).toHaveLength(1);
		expect(firstLoad.selectedLocation?.displayName).toBe('Fort Collins, Colorado, United States');
		expect(firstLoad.observations).toEqual([
			{
				weatherDate: '2020-01-01',
				maxTemperature: 12,
				minTemperature: 2,
				precipitation: 1.5
			},
			{
				weatherDate: '2020-01-02',
				maxTemperature: 14,
				minTemperature: 4,
				precipitation: 0
			}
		]);
		expect(firstLoad.summary).toEqual({
			observationCount: 2,
			avgHigh: 13,
			avgLow: 3,
			totalPrecipitation: 1.5,
			hottestDate: '2020-01-02',
			hottestTemperature: 14,
			wettestDate: '2020-01-01',
			wettestPrecipitation: 1.5
		});
		expect(secondLoad).toEqual(firstLoad);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('searchLocations', () => {
	test('rethrows upstream geocoding failures', async () => {
		globalThis.fetch = mock(async () => {
			throw new Error('network down');
		}) as typeof fetch;

		const { searchLocations } = await import('./weather');

		await expect(searchLocations('denver')).rejects.toThrow('network down');
		expect(sqlitePrepare).toHaveBeenCalledTimes(2);
	});
});
