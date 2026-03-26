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
						maxTemperatureC: 17.8,
						precipitationMm: 0
					}
				],
				summary: {
					observationCount: 1,
					totalPrecipitationMm: 0,
					avgHighC: 17.8,
					wettestDate: '2026-03-01',
					wettestPrecipitationMm: 0,
					monthlyHighC: 17.8
				}
			}
		});

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Fort Collins weather history, stored locally.');
	});
});
