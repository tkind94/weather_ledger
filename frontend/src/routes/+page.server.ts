import type { PageServerLoad } from './$types';

import { loadWeatherHistory, loadMonthlyExtremes } from '$lib/server/weather';

export const load: PageServerLoad = async () => {
	const [observations, monthlyExtremes] = await Promise.all([
		loadWeatherHistory(),
		loadMonthlyExtremes()
	]);
	return { observations, monthlyExtremes };
};
