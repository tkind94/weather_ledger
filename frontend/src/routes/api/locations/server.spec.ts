import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enqueueLocationJob, searchKnownLocations } = vi.hoisted(() => ({
	enqueueLocationJob: vi.fn(),
	searchKnownLocations: vi.fn()
}));

vi.mock('$lib/server/location-pipeline', () => ({
	enqueueLocationJob
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
		const job = {
			jobId: 'job-123',
			latitude: 40.39776,
			longitude: -105.07498,
			status: 'queued',
			createdAt: '2026-03-18T12:00:00Z',
			updatedAt: '2026-03-18T12:00:00Z',
			startedAt: null,
			finishedAt: null,
			location: null,
			message: null,
			partialSuccess: false
		};
		enqueueLocationJob.mockResolvedValue(job);

		const response = await POST({
			request: jsonRequest({ latitude: 40.39776, longitude: -105.07498 })
		} as Parameters<typeof POST>[0]);

		expect(enqueueLocationJob).toHaveBeenCalledWith(40.39776, -105.07498);
		expect(response.status).toBe(202);
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({ job });
	});

	it('returns a public queue error when the enqueue step fails', async () => {
		enqueueLocationJob.mockRejectedValue(new Error('database is locked'));

		const response = await POST({
			request: jsonRequest({ latitude: 40.39776, longitude: -105.07498 })
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(503);
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({
			message: 'Unable to queue that location right now. Retry the request.'
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
