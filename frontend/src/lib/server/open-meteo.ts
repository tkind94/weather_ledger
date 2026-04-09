import 'server-only';

import {
	buildLocationKey,
	buildLocationLabel,
	type LocationSeed,
	type WeatherObservation
} from '@/lib/weather';

type GeocodingResult = {
	name: string;
	admin1?: string;
	country?: string;
	latitude: number;
	longitude: number;
	timezone?: string;
};

type GeocodingResponse = {
	results?: GeocodingResult[];
};

type ArchiveDaily = {
	time: string[];
	temperature_2m_max: Array<number | null>;
	temperature_2m_min: Array<number | null>;
	precipitation_sum: Array<number | null>;
};

type ArchiveResponse = {
	daily?: ArchiveDaily;
};

export function observationsFromArchiveDaily(daily: ArchiveDaily): WeatherObservation[] {
	const observations: WeatherObservation[] = [];
	for (let index = 0; index < daily.time.length; index += 1) {
		const maxTemperature = daily.temperature_2m_max[index];
		const minTemperature = daily.temperature_2m_min[index];
		if (maxTemperature == null || minTemperature == null) {
			continue;
		}

		observations.push({
			weatherDate: daily.time[index],
			maxTemperature,
			minTemperature,
			precipitation: daily.precipitation_sum[index] ?? 0
		});
	}

	return observations;
}

export function observationsFromArchiveResponse(payload: ArchiveResponse): WeatherObservation[] {
	if (!('daily' in payload) || payload.daily == null) {
		throw new Error('Open-Meteo archive response did not include daily observations.');
	}

	return observationsFromArchiveDaily(payload.daily);
}

export async function searchRemoteLocations(query: string): Promise<LocationSeed[]> {
	const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
	url.searchParams.set('name', query);
	url.searchParams.set('count', '8');
	url.searchParams.set('language', 'en');
	url.searchParams.set('format', 'json');

	const response = await fetch(url, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`Open-Meteo geocoding failed with ${response.status}.`);
	}

	const payload = (await response.json()) as GeocodingResponse;
	const results = payload.results ?? [];

	return results.map((result) => {
		const admin1 = result.admin1 ?? null;
		const country = result.country ?? null;
		return {
			locationKey: buildLocationKey({
				name: result.name,
				admin1,
				country,
				latitude: result.latitude,
				longitude: result.longitude
			}),
			displayName: buildLocationLabel({ name: result.name, admin1, country }),
			name: result.name,
			admin1,
			country,
			latitude: result.latitude,
			longitude: result.longitude,
			timezone: result.timezone ?? 'auto'
		};
	});
}

export async function fetchLocationWeather(
	location: LocationSeed,
	startDate: string,
	endDate: string
): Promise<WeatherObservation[]> {
	const url = new URL('https://archive-api.open-meteo.com/v1/archive');
	url.searchParams.set('latitude', location.latitude.toString());
	url.searchParams.set('longitude', location.longitude.toString());
	url.searchParams.set('start_date', startDate);
	url.searchParams.set('end_date', endDate);
	url.searchParams.set(
		'daily',
		['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'].join(',')
	);
	url.searchParams.set('timezone', location.timezone || 'auto');

	const response = await fetch(url, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`Open-Meteo archive failed with ${response.status}.`);
	}

	const payload = (await response.json()) as ArchiveResponse;
	return observationsFromArchiveResponse(payload);
}
