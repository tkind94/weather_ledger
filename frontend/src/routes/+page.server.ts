import type { PageServerLoad } from './$types';

import { loadDashboard } from '$lib/server/weather';

export const load: PageServerLoad = () => loadDashboard();
