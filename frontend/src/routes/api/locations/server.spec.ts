import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	ensureLocationFromCoordinates,
	searchKnownLocations,
	MockPipelineRebuildError,
	MockLocationPipelineError
} = vi.hoisted(() => {
	class MockPipelineRebuildError extends Error {
		readonly location: Record<string, unknown>;
		readonly userMessage: string;

		constructor(location: Record<string, unknown>, userMessage = 'Dashboard rebuild failed') {
			super(userMessage);
			this.name = 'PipelineRebuildError';
			this.location = location;
			this.userMessage = userMessage;
		}
	}

	class MockLocationPipelineError extends Error {
		readonly userMessage: string;
		readonly statusCode: number;

		constructor(userMessage: string, statusCode: number) {
			super(userMessage);
			this.name = 'LocationPipelineError';
			this.userMessage = userMessage;
			this.statusCode = statusCode;
		}
	}

	return {
		ensureLocationFromCoordinates: vi.fn(),
		searchKnownLocations: vi.fn(),
		MockPipelineRebuildError,
		MockLocationPipelineError
	};
});

vi.mock('$lib/server/location-pipeline', () => ({
	ensureLocationFromCoordinates,
	PipelineRebuildError: MockPipelineRebuildError,
	LocationPipelineError: MockLocationPipelineError
}));

vi.mock('$lib/server/weather', () => ({
	searchKnownLocations
}));

import { GET, POST } from './+server';

function jsonRequest(body: unknown): Request {
	return new Request('http://test/api/locations', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('/api/locations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns an empty result set for blank search queries', async () => {
		const response = await GET({ url: new URL('http://test/api/locations?q=') } as Parameters<
			typeof GET
		>[0]);

		expect(searchKnownLocations).not.toHaveBeenCalled();
		expect(response.headers.get('cache-control')).toBe(
			'private, max-age=5, stale-while-revalidate=30'
		);
		await expect(response.json()).resolves.toEqual({ locations: [] });
	});

	it('searches cached locations for non-empty queries', async () => {
		searchKnownLocations.mockResolvedValue([
			{ locationKey: 'boulder-colorado-us', canonicalName: 'Boulder, Colorado, United States' }
		]);

		const response = await GET({
			url: new URL('http://test/api/locations?q=Boulder')
		} as Parameters<typeof GET>[0]);

		expect(searchKnownLocations).toHaveBeenCalledWith('Boulder');
		await expect(response.json()).resolves.toEqual({
			locations: [
				{ locationKey: 'boulder-colorado-us', canonicalName: 'Boulder, Colorado, United States' }
			]
		});
	});

	it('returns the ensured location for successful map requests', async () => {
		const location = {
			locationKey: 'loveland-colorado-us',
			canonicalName: 'Loveland, Colorado, United States',
			rowsStored: 0,
			existingLocation: true
		};
		ensureLocationFromCoordinates.mockResolvedValue(location);

		const response = await POST({
			request: jsonRequest({ latitude: 40.39776, longitude: -105.07498 })
		} as Parameters<typeof POST>[0]);

		expect(ensureLocationFromCoordinates).toHaveBeenCalledWith(40.39776, -105.07498);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ location });
	});

	it('returns partial success details when rebuild fails after caching', async () => {
		const location = {
			locationKey: 'loveland-colorado-us',
			canonicalName: 'Loveland, Colorado, United States',
			rowsStored: 4,
			existingLocation: false
		};
		ensureLocationFromCoordinates.mockRejectedValue(
			new MockPipelineRebuildError(location, 'Cached rows but dbt failed')
		);

		const response = await POST({
			request: jsonRequest({ latitude: 40.39776, longitude: -105.07498 })
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			location,
			message: 'Cached rows but dbt failed',
			partialSuccess: true
		});
	});

	it('returns mapped pipeline errors with their public status code', async () => {
		ensureLocationFromCoordinates.mockRejectedValue(
			new MockLocationPipelineError('The local weather database is busy.', 503)
		);

		const response = await POST({
			request: jsonRequest({ latitude: 40.39776, longitude: -105.07498 })
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			message: 'The local weather database is busy.'
		});
	});

	it('rejects invalid coordinates at the request boundary', async () => {
		await expect(
			POST({ request: jsonRequest({ latitude: 91, longitude: -105.07498 }) } as Parameters<
				typeof POST
			>[0])
		).rejects.toMatchObject({ status: 400 });
	});
});
