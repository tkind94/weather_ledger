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

type ArchiveResponse = {
	daily?: {
		time: string[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_sum: number[];
	};
};

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
	const daily = payload.daily;
	if (!daily) {
		return [];
	}

	return daily.time.map((weatherDate, index) => ({
		weatherDate,
		maxTemperature: daily.temperature_2m_max[index] ?? 0,
		minTemperature: daily.temperature_2m_min[index] ?? 0,
		precipitation: daily.precipitation_sum[index] ?? 0
	}));
}
