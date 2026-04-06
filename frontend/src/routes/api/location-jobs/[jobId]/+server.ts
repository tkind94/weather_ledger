import { error, json } from '@sveltejs/kit';

import { getLocationJob } from '$lib/server/location-pipeline';

import type { RequestHandler } from './$types';

const noStoreHeaders = { 'cache-control': 'no-store' };

export const GET: RequestHandler = async ({ params }) => {
	const jobId = params.jobId?.trim() ?? '';
	if (jobId === '') {
		throw error(404, 'Location job not found');
	}

	const job = await getLocationJob(jobId);
	if (job === null) {
		throw error(404, 'Location job not found');
	}

	return json({ job }, { headers: noStoreHeaders });
};
