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
						maxTemperature: 17.8,
						precipitation: 0
					}
				],
				summary: {
					observationCount: 1,
					totalPrecipitation: 0,
					avgHigh: 17.8,
					wettestDate: '2026-03-01',
					wettestPrecipitation: 0,
					monthlyHigh: 17.8
				}
			}
		});

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Fort Collins weather history, stored locally.');
	});
});
