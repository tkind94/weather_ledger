import type { PageServerLoad } from './$types';

import { ensureDefaultLocationData } from '$lib/server/location-pipeline';
import { hasCachedLocations, loadDashboard } from '$lib/server/weather';

export const load: PageServerLoad = async ({ url }) => {
	if (!(await hasCachedLocations())) {
		await ensureDefaultLocationData();
	}

	return loadDashboard(url.searchParams.get('location'));
};
