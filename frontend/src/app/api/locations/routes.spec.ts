import { afterEach, describe, expect, mock, test } from 'bun:test';

let cacheFailure: Error | null = null;
let searchFailure: Error | null = null;

const revalidatePath = mock(() => {});

const cacheLocationWeather = mock(async (location) => {
	if (cacheFailure) {
		throw cacheFailure;
	}

	return {
		...location,
		observationCount: 365,
		firstObservationDate: '2025-04-08',
		latestObservationDate: '2026-04-08',
		lastFetchedAt: '2026-04-08T12:00:00.000Z'
	};
});

const searchLocations = mock(async () => {
	if (searchFailure) {
		throw searchFailure;
	}

	return [];
});

mock.module('@/lib/server/weather', () => ({
	cacheLocationWeather,
	searchLocations
}));

mock.module('next/cache', () => ({
	revalidatePath
}));

const originalConsoleError = console.error;

function locationRequest(body: unknown): Request {
	return new Request('http://example.com/api/locations', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(body)
	});
}

afterEach(() => {
	cacheFailure = null;
	searchFailure = null;
	console.error = originalConsoleError;
	mock.clearAllMocks();
});

describe('POST /api/locations', () => {
	test('returns 400 when the location payload is missing', async () => {
		const { POST } = await import('./route');

		const response = await POST(locationRequest({}));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Location payload is required.' });
		expect(cacheLocationWeather).not.toHaveBeenCalled();
	});

	test('derives the cache identity from canonicalized coordinates', async () => {
		const { POST } = await import('./route');

		const response = await POST(
			locationRequest({
				location: {
					locationKey: 'client-key',
					displayName: 'Client Label',
					name: 'Boulder',
					admin1: 'Colorado',
					country: 'United States',
					latitude: 40.123456,
					longitude: -105.987654,
					timezone: 'America/Denver'
				}
			})
		);

		expect(response.status).toBe(200);
		expect(cacheLocationWeather).toHaveBeenCalledWith({
			locationKey: '40.1235,-105.9877',
			displayName: 'Boulder, Colorado, United States',
			name: 'Boulder',
			admin1: 'Colorado',
			country: 'United States',
			latitude: 40.1235,
			longitude: -105.9877,
			timezone: 'America/Denver'
		});

		const payload = (await response.json()) as {
			location: {
				locationKey: string;
			};
		};
		expect(payload.location.locationKey).toBe('40.1235,-105.9877');
		expect(revalidatePath).toHaveBeenCalledWith('/');
	});

	test('logs server failures and returns a stable 500 response', async () => {
		cacheFailure = new Error('sqlite exploded');
		const consoleError = mock(() => {});
		console.error = consoleError as typeof console.error;
		const { POST } = await import('./route');

		const response = await POST(
			locationRequest({
				location: {
					name: 'Boulder',
					admin1: 'Colorado',
					country: 'United States',
					latitude: 40.123456,
					longitude: -105.987654,
					timezone: 'America/Denver'
				}
			})
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Internal server error' });
		expect(consoleError).toHaveBeenCalledWith('Failed to cache location weather.', cacheFailure);
	});
});

describe('GET /api/locations/search', () => {
	test('logs upstream failures and returns a stable 500 response', async () => {
		searchFailure = new Error('network down');
		const consoleError = mock(() => {});
		console.error = consoleError as typeof console.error;
		const { GET } = await import('./search/route');

		const response = await GET(new Request('http://example.com/api/locations/search?q=denver'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Internal server error' });
		expect(consoleError).toHaveBeenCalledWith('Failed to search locations.', searchFailure);
	});
});
