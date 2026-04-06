import { test, expect, type Page } from '@playwright/test';

import { TEST_MAP_LOCATION_KEY, TEST_MAP_LOCATION_NAME } from './test-db.js';

async function disableMapTiles(page: Page) {
	await page.route('https://*.tile.openstreetmap.org/**', async (route) => {
		await route.abort();
	});
}

async function openCachedLocation(page: Page, query: string, name: string) {
	await page.getByLabel('Cached locations').fill(query);
	await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
}

async function clickMapAndWaitForLocationPost(page: Page) {
	const addLocationResponse = page.waitForResponse((response) => {
		return response.url().endsWith('/api/locations') && response.request().method() === 'POST';
	});

	await page.getByLabel('Location picker map').click();
	return addLocationResponse;
}

test('cached search can open the first match with the Open button', async ({ page }) => {
	await page.goto('/');

	await page.getByLabel('Cached locations').fill('Boulder');
	await expect(page.getByRole('button', { name: 'Open' })).toBeEnabled();
	await page.getByRole('button', { name: 'Open' }).click();

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Boulder');
	await expect(page).toHaveURL(/\?location=boulder-colorado-us$/);
});

test('cached search shows guidance when no cached location matches', async ({ page }) => {
	await page.goto('/');

	await page.getByLabel('Cached locations').fill('zzzz');

	await expect(page.getByRole('button', { name: 'Open' })).toBeDisabled();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Fort Collins');
});

test('weather stats page can switch between cached locations', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Fort Collins');
	await openCachedLocation(page, 'Boulder', 'Boulder, Colorado, United States');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Boulder');
});

test('unit selection persists when switching cached locations', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Imperial' }).click();
	await expect(page.getByText('57.2 °F').first()).toBeVisible();

	await openCachedLocation(page, 'Boulder', 'Boulder, Colorado, United States');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Boulder');
	await expect(page.getByText('55.6 °F').first()).toBeVisible();
	await expect(page.getByText('0.19 in').first()).toBeVisible();
});

test('weather stats page can add a location from the map flow without public APIs', async ({
	page
}) => {
	await disableMapTiles(page);

	await page.goto('/');

	const map = page.getByLabel('Location picker map');
	await expect(map).toBeVisible();
	await expect(map).toHaveClass(/leaflet-container/);

	const response = await clickMapAndWaitForLocationPost(page);
	expect(response.status()).toBe(202);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEST_MAP_LOCATION_NAME);
	await expect(page).toHaveURL(new RegExp(`\\?location=${TEST_MAP_LOCATION_KEY}$`));
	await expect(page.getByText(`${TEST_MAP_LOCATION_NAME} is already up to date.`)).toBeVisible();
	await expect(page.getByText('40.398° N, 105.075° W').first()).toBeVisible();
	await expect(
		page.getByRole('heading', {
			level: 2,
			name: `Daily observations for ${TEST_MAP_LOCATION_NAME}`
		})
	).toBeVisible();
	await expect(page.getByRole('row', { name: '2026-03-13 14.4 °C 0.20 mm' })).toBeVisible();
});

test('weather stats page surfaces location load failures without navigation', async ({ page }) => {
	await disableMapTiles(page);
	await page.route('**/api/locations', async (route) => {
		await route.fulfill({
			status: 503,
			contentType: 'application/json',
			body: JSON.stringify({
				message: 'The local weather database is busy. Retry the request in a moment.'
			})
		});
	});

	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Fort Collins, Colorado, United States'
	);

	await page.getByLabel('Location picker map').click();

	await expect(
		page.getByText('The local weather database is busy. Retry the request in a moment.')
	).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Fort Collins, Colorado, United States'
	);
	await expect(page).toHaveURL(/\/$/);
});

test('weather stats page can return to Fort Collins after adding a location from the map', async ({
	page
}) => {
	await disableMapTiles(page);

	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Fort Collins, Colorado, United States'
	);

	const response = await clickMapAndWaitForLocationPost(page);
	expect(response.status()).toBe(202);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEST_MAP_LOCATION_NAME);

	await openCachedLocation(page, 'Fort Collins', 'Fort Collins, Colorado, United States');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Fort Collins, Colorado, United States'
	);
});

test('weather stats page can handle sequential map picks for different locations', async ({
	page
}) => {
	await disableMapTiles(page);

	const sequentialLocations = [
		{
			jobId: 'job-boulder',
			latitude: 40.01499,
			longitude: -105.27055,
			locationKey: 'boulder-colorado-us',
			canonicalName: 'Boulder, Colorado, United States'
		},
		{
			jobId: 'job-loveland',
			latitude: 40.39776,
			longitude: -105.07498,
			locationKey: TEST_MAP_LOCATION_KEY,
			canonicalName: TEST_MAP_LOCATION_NAME
		}
	];
	const jobStatusResponses = new Map<string, Array<Record<string, unknown>>>([
		[
			'job-boulder',
			[
				{
					status: 'running',
					startedAt: '2026-03-18T12:00:05Z',
					finishedAt: null,
					location: {
						locationKey: 'boulder-colorado-us',
						canonicalName: 'Boulder, Colorado, United States',
						rowsStored: 0,
						existingLocation: true
					}
				},
				{
					status: 'running',
					startedAt: '2026-03-18T12:00:05Z',
					finishedAt: null,
					location: {
						locationKey: 'boulder-colorado-us',
						canonicalName: 'Boulder, Colorado, United States',
						rowsStored: 0,
						existingLocation: true
					}
				},
				{
					status: 'succeeded',
					startedAt: '2026-03-18T12:00:05Z',
					finishedAt: '2026-03-18T12:00:07Z',
					location: {
						locationKey: 'boulder-colorado-us',
						canonicalName: 'Boulder, Colorado, United States',
						rowsStored: 0,
						existingLocation: true
					}
				}
			]
		],
		[
			'job-loveland',
			[
				{
					status: 'running',
					startedAt: '2026-03-18T12:00:06Z',
					finishedAt: null,
					location: {
						locationKey: TEST_MAP_LOCATION_KEY,
						canonicalName: TEST_MAP_LOCATION_NAME,
						rowsStored: 0,
						existingLocation: true
					}
				},
				{
					status: 'succeeded',
					startedAt: '2026-03-18T12:00:06Z',
					finishedAt: '2026-03-18T12:00:07Z',
					location: {
						locationKey: TEST_MAP_LOCATION_KEY,
						canonicalName: TEST_MAP_LOCATION_NAME,
						rowsStored: 0,
						existingLocation: true
					}
				}
			]
		]
	]);

	await page.route('**/api/locations', async (route) => {
		if (route.request().method() !== 'POST') {
			await route.continue();
			return;
		}

		const nextLocation = sequentialLocations.shift();
		if (!nextLocation) {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Unexpected extra map pick' })
			});
			return;
		}

		await route.fulfill({
			status: 202,
			contentType: 'application/json',
			body: JSON.stringify({
				job: {
					jobId: nextLocation.jobId,
					latitude: nextLocation.latitude,
					longitude: nextLocation.longitude,
					status: 'queued',
					createdAt: '2026-03-18T12:00:00Z',
					updatedAt: '2026-03-18T12:00:00Z',
					startedAt: null,
					finishedAt: null,
					location: null,
					message: null,
					partialSuccess: false
				}
			})
		});
	});
	await page.route('**/api/location-jobs/*', async (route) => {
		const jobId = route.request().url().split('/').pop() ?? '';
		const states = jobStatusResponses.get(jobId);
		if (!states || states.length === 0) {
			await route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Unknown job' })
			});
			return;
		}

		const currentState = states.shift() ?? states[states.length - 1];
		const seed =
			jobId === 'job-boulder'
				? {
						latitude: 40.01499,
						longitude: -105.27055,
						createdAt: '2026-03-18T12:00:00Z'
					}
				: {
						latitude: 40.39776,
						longitude: -105.07498,
						createdAt: '2026-03-18T12:00:01Z'
					};

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				job: {
					jobId,
					latitude: seed.latitude,
					longitude: seed.longitude,
					createdAt: seed.createdAt,
					updatedAt: '2026-03-18T12:00:07Z',
					message: null,
					partialSuccess: false,
					...currentState
				}
			})
		});
	});

	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Fort Collins, Colorado, United States'
	);

	let response = await clickMapAndWaitForLocationPost(page);
	expect(response.status()).toBe(202);

	response = await clickMapAndWaitForLocationPost(page);
	expect(response.status()).toBe(202);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEST_MAP_LOCATION_NAME);
	await expect(page).toHaveURL(new RegExp(`\\?location=${TEST_MAP_LOCATION_KEY}$`));

	await openCachedLocation(page, 'Boulder', 'Boulder, Colorado, United States');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Boulder, Colorado, United States'
	);
});
