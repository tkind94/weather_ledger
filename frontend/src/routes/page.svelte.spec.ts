import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

vi.mock('$lib/vendor/leaflet-client', () => {
	const fakeMap = {
		setView() {
			return fakeMap;
		},
		on() {
			return fakeMap;
		},
		remove() {}
	};
	const fakeTileLayer = {
		addTo() {
			return fakeTileLayer;
		}
	};
	const fakeCircleMarker = {
		addTo() {
			return fakeCircleMarker;
		},
		setLatLng() {
			return fakeCircleMarker;
		},
		remove() {}
	};

	return {
		loadLeaflet: async () => ({
			map: () => fakeMap,
			tileLayer: () => fakeTileLayer,
			circleMarker: () => fakeCircleMarker
		})
	};
});

import { unitSystem } from '$lib/stores/units';
import type { DashboardPageData, KnownLocation, DashboardSummary } from '$lib/weather';

import Page from './+page.svelte';

const fortCollins: KnownLocation = {
	locationKey: 'fort-collins-colorado-us',
	canonicalName: 'Fort Collins, Colorado, United States',
	admin1: 'Colorado',
	country: 'United States',
	latitude: 40.5852,
	longitude: -105.0844,
	timezone: 'America/Denver',
	observationCount: 2,
	firstObservationDate: '2026-03-13',
	latestObservationDate: '2026-03-14',
	lastFetchedAt: '2026-03-15T09:00:00Z'
};

const summary: DashboardSummary = {
	locationKey: 'fort-collins-colorado-us',
	observationCount: 2,
	totalPrecipitation: 2.3,
	avgHigh: 14.0,
	wettestDate: '2026-03-14',
	wettestPrecipitation: 2.3,
	monthlyHigh: 15.2
};

const observations = [
	{ weatherDate: '2026-03-13', maxTemperature: 15.2, precipitation: 0.0 },
	{ weatherDate: '2026-03-14', maxTemperature: 12.8, precipitation: 2.3 }
];

function fullData(overrides: Partial<DashboardPageData> = {}): { data: DashboardPageData } {
	return {
		data: {
			selectedLocation: fortCollins,
			observations,
			summary,
			locationCount: 3,
			...overrides
		}
	};
}

afterEach(() => {
	unitSystem.set('metric');
	localStorage.removeItem('weather_units_system');
});

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		render(Page, fullData());

		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
		await expect.element(heading).toHaveTextContent('Fort Collins, Colorado, United States');
	});

	it('renders empty state when selectedLocation is null', async () => {
		render(Page, fullData({ selectedLocation: null, observations: [], summary: null }));

		const heading = page.getByRole('heading', { level: 1 });
		await expect
			.element(heading)
			.toHaveTextContent('Pick a place and build its local weather ledger.');

		await expect.element(page.getByText('No observations loaded yet.')).toBeInTheDocument();

		// Table should not render
		await expect.element(page.getByRole('table')).not.toBeInTheDocument();
	});

	it('displays all four metric cards with formatted summary values', async () => {
		render(Page, fullData());

		// Use .first() to avoid strict-mode multi-match issues (values also appear in table)
		await expect.element(page.getByText('2.30 mm').first()).toBeInTheDocument();
		await expect.element(page.getByText('14.0 °C').first()).toBeInTheDocument();
		await expect.element(page.getByText('15.2 °C').first()).toBeInTheDocument();
		await expect.element(page.getByText('2026-03-14').first()).toBeInTheDocument();
	});

	it('renders observation table rows', async () => {
		render(Page, fullData());

		const rows = page.getByRole('row');
		// 1 header row + 2 data rows = 3
		await expect.element(rows.nth(1)).toHaveTextContent('2026-03-13');
		await expect.element(rows.nth(2)).toHaveTextContent('2026-03-14');
	});

	it('shows location metadata badges', async () => {
		render(Page, fullData());

		await expect.element(page.getByText('3 cached locations')).toBeInTheDocument();
		await expect.element(page.getByText('40.585° N, 105.084° W').first()).toBeInTheDocument();
		await expect.element(page.getByText('2 daily observations')).toBeInTheDocument();
		await expect.element(page.getByText('America/Denver')).toBeInTheDocument();
	});

	it('shows singular "location" when count is 1', async () => {
		render(Page, fullData({ locationCount: 1 }));

		await expect.element(page.getByText('1 cached location')).toBeInTheDocument();
	});

	it('metric cards show dashes when summary is null', async () => {
		render(Page, fullData({ summary: null }));

		const dashes = page.getByText('—');
		// All 4 metric cards should show dashes
		await expect.element(dashes.first()).toBeInTheDocument();
	});

	it('chart and table hidden when observations empty', async () => {
		render(Page, fullData({ observations: [] }));

		await expect.element(page.getByText('No observations loaded yet.')).toBeInTheDocument();

		// Chart heading should not appear
		await expect
			.element(page.getByText('precipitation versus max temperature'))
			.not.toBeInTheDocument();
	});

	it('switches summary and table values when unit system changes', async () => {
		render(Page, fullData());

		unitSystem.set('imperial');

		await expect.element(page.getByText('0.09 in').first()).toBeInTheDocument();
		await expect.element(page.getByText('57.2 °F').first()).toBeInTheDocument();
		await expect.element(page.getByText('59.4 °F').first()).toBeInTheDocument();
	});
});
