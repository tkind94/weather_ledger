import { error, json } from '@sveltejs/kit';

import { enqueueLocationJob } from '$lib/server/location-pipeline';
import { searchKnownLocations } from '$lib/server/weather';

import type { RequestHandler } from './$types';

const searchCacheControl = 'private, max-age=5, stale-while-revalidate=30';

function parseLatitude(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < -90 || value > 90) {
		throw error(400, 'Latitude must be a number between -90 and 90');
	}

	return value;
}

function parseLongitude(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < -180 || value > 180) {
		throw error(400, 'Longitude must be a number between -180 and 180');
	}

	return value;
}

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';

	if (query.length === 0) {
		return json({ locations: [] }, { headers: { 'cache-control': searchCacheControl } });
	}

	const locations = await searchKnownLocations(query);
	return json({ locations }, { headers: { 'cache-control': searchCacheControl } });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	if (typeof body !== 'object' || body === null) {
		throw error(400, 'Request body must be a JSON object');
	}

	const latitude = parseLatitude((body as { latitude?: unknown }).latitude);
	const longitude = parseLongitude((body as { longitude?: unknown }).longitude);

	try {
		const job = await enqueueLocationJob(latitude, longitude);
		return json({ job }, { status: 202, headers: { 'cache-control': 'no-store' } });
	} catch {
		return json(
			{ message: 'Unable to queue that location right now. Retry the request.' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		);
	}
};
