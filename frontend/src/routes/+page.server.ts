import type { PageServerLoad } from './$types';

import { loadWeatherHistory } from '$lib/server/weather';


export const load: PageServerLoad = async () => {
	return {
		observations: await loadWeatherHistory()
	};
};