import { revalidatePath } from 'next/cache';

import { cacheLocationWeather } from '@/lib/server/weather';
import { canonicalizeLocationSeed, type LocationSeed } from '@/lib/weather';

export const dynamic = 'force-dynamic';

type LocationRequest = {
	location?: unknown;
};

function badRequest(message: string): Response {
	return Response.json({ error: message }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function readRequiredString(
	value: Record<string, unknown>,
	fieldName: string,
	errorMessage: string
): string | Response {
	const fieldValue = value[fieldName];
	if (typeof fieldValue !== 'string' || fieldValue.trim() === '') {
		return badRequest(errorMessage);
	}

	return fieldValue;
}

function readOptionalString(
	value: Record<string, unknown>,
	fieldName: string
): string | null | Response {
	const fieldValue = value[fieldName];
	if (fieldValue === undefined || fieldValue === null) {
		return null;
	}
	if (typeof fieldValue !== 'string') {
		return badRequest(`${fieldName} must be a string or null.`);
	}

	return fieldValue;
}

function readCoordinate(
	value: Record<string, unknown>,
	fieldName: string,
	minimum: number,
	maximum: number
): number | Response {
	const fieldValue = value[fieldName];
	if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
		return badRequest(`${fieldName} must be a finite number.`);
	}
	if (fieldValue < minimum || fieldValue > maximum) {
		return badRequest(`${fieldName} must be between ${minimum} and ${maximum}.`);
	}

	return fieldValue;
}

function parseLocationRequest(payload: unknown): LocationSeed | Response {
	if (!isRecord(payload)) {
		return badRequest('Request body must be a JSON object.');
	}
	if (!isRecord(payload.location)) {
		return badRequest('Location payload is required.');
	}

	const name = readRequiredString(payload.location, 'name', 'Location name is required.');
	if (name instanceof Response) {
		return name;
	}

	const admin1 = readOptionalString(payload.location, 'admin1');
	if (admin1 instanceof Response) {
		return admin1;
	}

	const country = readOptionalString(payload.location, 'country');
	if (country instanceof Response) {
		return country;
	}

	const latitude = readCoordinate(payload.location, 'latitude', -90, 90);
	if (latitude instanceof Response) {
		return latitude;
	}

	const longitude = readCoordinate(payload.location, 'longitude', -180, 180);
	if (longitude instanceof Response) {
		return longitude;
	}

	const timezone = readRequiredString(
		payload.location,
		'timezone',
		'Location timezone is required.'
	);
	if (timezone instanceof Response) {
		return timezone;
	}

	return canonicalizeLocationSeed({ name, admin1, country, latitude, longitude, timezone });
}

export async function POST(request: Request): Promise<Response> {
	try {
		const payload = (await request.json()) as LocationRequest;
		const location = parseLocationRequest(payload);
		if (location instanceof Response) {
			return location;
		}

		const cachedLocation = await cacheLocationWeather(location);
		revalidatePath('/');
		return Response.json({ location: cachedLocation });
	} catch (error) {
		if (error instanceof SyntaxError) {
			return badRequest('Request body must be valid JSON.');
		}

		console.error('Failed to cache location weather.', error);
		return Response.json({ error: 'Internal server error' }, { status: 500 });
	}
}
