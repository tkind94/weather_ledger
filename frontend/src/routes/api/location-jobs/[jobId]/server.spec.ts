import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getLocationJob } = vi.hoisted(() => ({
	getLocationJob: vi.fn()
}));

vi.mock('$lib/server/location-pipeline', () => ({
	getLocationJob
}));

import { GET } from './+server';

describe('/api/location-jobs/[jobId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a queued job status for polling clients', async () => {
		getLocationJob.mockResolvedValue({
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
		});

		const response = await GET({ params: { jobId: 'job-123' } } as Parameters<typeof GET>[0]);

		expect(getLocationJob).toHaveBeenCalledWith('job-123');
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({
			job: {
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
			}
		});
	});

	it('returns 404 when the job id is unknown', async () => {
		getLocationJob.mockResolvedValue(null);

		await expect(
			GET({ params: { jobId: 'missing-job' } } as Parameters<typeof GET>[0])
		).rejects.toMatchObject({ status: 404 });
	});
});
