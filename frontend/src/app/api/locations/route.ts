import { cacheLocationWeather } from '@/lib/server/weather';
import { type LocationSeed } from '@/lib/weather';

export const dynamic = 'force-dynamic';

type LocationRequest = {
	location: Partial<LocationSeed>;
};

function isLocationSeed(value: Partial<LocationSeed>): value is LocationSeed {
	return (
		typeof value.locationKey === 'string' &&
		typeof value.displayName === 'string' &&
		typeof value.name === 'string' &&
		(typeof value.admin1 === 'string' || value.admin1 === null) &&
		(typeof value.country === 'string' || value.country === null) &&
		typeof value.latitude === 'number' &&
		typeof value.longitude === 'number' &&
		typeof value.timezone === 'string'
	);
}

export async function POST(request: Request): Promise<Response> {
	try {
		const payload = (await request.json()) as LocationRequest;
		if (!isLocationSeed(payload.location)) {
			return Response.json({ message: 'Invalid location payload.' }, { status: 400 });
		}

		const location = await cacheLocationWeather(payload.location);
		return Response.json({ location });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to cache this location.';
		return Response.json({ message }, { status: 500 });
	}
}
