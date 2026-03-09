import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';

import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		render(Page, {
			data: {
				observations: [
					{
						weatherDate: '2026-03-01',
						latitude: 40.5852,
						longitude: -105.0844,
						timezone: 'America/Denver',
						maxTemperatureC: 17.8,
						precipitationMm: 0,
						source: 'open-meteo-historical',
						fetchedAt: '2026-03-07T09:00:00+00:00'
					}
				]
			}
		});

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Fort Collins weather history, stored locally.');
	});
});
