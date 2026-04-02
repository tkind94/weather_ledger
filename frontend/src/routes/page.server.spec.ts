import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureDefaultLocationData, hasCachedLocations, loadDashboard } = vi.hoisted(() => ({
	ensureDefaultLocationData: vi.fn(),
	hasCachedLocations: vi.fn(),
	loadDashboard: vi.fn()
}));

vi.mock('$lib/server/location-pipeline', () => ({
	ensureDefaultLocationData
}));

vi.mock('$lib/server/weather', () => ({
	hasCachedLocations,
	loadDashboard
}));

import { load } from './+page.server';

describe('/+page.server.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadDashboard.mockResolvedValue({
			selectedLocation: null,
			observations: [],
			summary: null,
			locationCount: 0
		});
	});

	it('hydrates the default location when the cache is empty', async () => {
		hasCachedLocations.mockResolvedValue(false);
		const dashboard = {
			selectedLocation: null,
			observations: [],
			summary: null,
			locationCount: 1
		};
		loadDashboard.mockResolvedValue(dashboard);

		const result = await load({ url: new URL('http://test/') } as Parameters<typeof load>[0]);

		expect(ensureDefaultLocationData).toHaveBeenCalledOnce();
		expect(loadDashboard).toHaveBeenCalledWith(null);
		expect(result).toBe(dashboard);
	});

	it('skips default hydration when cached locations already exist', async () => {
		hasCachedLocations.mockResolvedValue(true);

		await load({ url: new URL('http://test/') } as Parameters<typeof load>[0]);

		expect(ensureDefaultLocationData).not.toHaveBeenCalled();
		expect(loadDashboard).toHaveBeenCalledWith(null);
	});

	it('passes the requested location key through to loadDashboard', async () => {
		hasCachedLocations.mockResolvedValue(true);

		await load({ url: new URL('http://test/?location=boulder-colorado-us') } as Parameters<
			typeof load
		>[0]);

		expect(loadDashboard).toHaveBeenCalledWith('boulder-colorado-us');
	});
});
