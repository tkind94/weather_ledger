export type WeatherObservation = {
	weatherDate: string;
	maxTemperature: number;
	minTemperature: number;
	precipitation: number;
};

export type LocationSeed = {
	locationKey: string;
	displayName: string;
	name: string;
	admin1: string | null;
	country: string | null;
	latitude: number;
	longitude: number;
	timezone: string;
};

export type LocationCandidate = LocationSeed & {
	isCached: boolean;
};

export type LocationRecord = LocationSeed & {
	observationCount: number;
	firstObservationDate: string | null;
	latestObservationDate: string | null;
	lastFetchedAt: string | null;
};

export type DashboardSummary = {
	observationCount: number;
	avgHigh: number | null;
	avgLow: number | null;
	totalPrecipitation: number;
	hottestDate: string | null;
	hottestTemperature: number | null;
	wettestDate: string | null;
	wettestPrecipitation: number | null;
};

export type DashboardData = {
	cachedLocations: LocationRecord[];
	selectedLocation: LocationRecord | null;
	observations: WeatherObservation[];
	summary: DashboardSummary | null;
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
});

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
});

function toDate(dateString: string): Date {
	return new Date(`${dateString}T12:00:00Z`);
}

function slugPart(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-');
}

function coordinateToken(value: number): string {
	return value.toFixed(3).replace(/-/g, 'm').replace(/\./g, '-');
}

export function buildLocationLabel(parts: {
	name: string;
	admin1: string | null;
	country: string | null;
}): string {
	return [parts.name, parts.admin1, parts.country].filter(Boolean).join(', ');
}

export function buildLocationKey(parts: {
	name: string;
	admin1: string | null;
	country: string | null;
	latitude: number;
	longitude: number;
}): string {
	return [
		slugPart(parts.name),
		parts.admin1 ? slugPart(parts.admin1) : null,
		parts.country ? slugPart(parts.country) : null,
		coordinateToken(parts.latitude),
		coordinateToken(parts.longitude)
	]
		.filter(Boolean)
		.join('-');
}

export function coordinateLabel(latitude: number, longitude: number): string {
	const northSouth = latitude >= 0 ? 'N' : 'S';
	const eastWest = longitude >= 0 ? 'E' : 'W';
	return `${Math.abs(latitude).toFixed(3)}° ${northSouth}, ${Math.abs(longitude).toFixed(3)}° ${eastWest}`;
}

export function formatDate(value: string | null): string {
	if (value === null) {
		return 'Not available';
	}

	return dateFormatter.format(toDate(value));
}

export function formatTimestamp(value: string | null): string {
	if (value === null) {
		return 'Not available';
	}

	return timestampFormatter.format(new Date(value));
}

export function formatTemperature(value: number | null): string {
	if (value === null) {
		return 'Not available';
	}

	return `${value.toFixed(1)}°C`;
}

export function formatPrecipitation(value: number | null): string {
	if (value === null) {
		return 'Not available';
	}

	return `${value.toFixed(1)} mm`;
}

export function formatDateRange(startDate: string | null, endDate: string | null): string {
	if (startDate === null || endDate === null) {
		return 'No cached history yet';
	}

	return `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

export function summarizeObservations(observations: WeatherObservation[]): DashboardSummary {
	if (observations.length === 0) {
		return {
			observationCount: 0,
			avgHigh: null,
			avgLow: null,
			totalPrecipitation: 0,
			hottestDate: null,
			hottestTemperature: null,
			wettestDate: null,
			wettestPrecipitation: null
		};
	}

	let totalHigh = 0;
	let totalLow = 0;
	let totalPrecipitation = 0;
	let hottestObservation = observations[0];
	let wettestObservation = observations[0];

	for (const observation of observations) {
		totalHigh += observation.maxTemperature;
		totalLow += observation.minTemperature;
		totalPrecipitation += observation.precipitation;

		if (observation.maxTemperature > hottestObservation.maxTemperature) {
			hottestObservation = observation;
		}

		if (observation.precipitation > wettestObservation.precipitation) {
			wettestObservation = observation;
		}
	}

	return {
		observationCount: observations.length,
		avgHigh: totalHigh / observations.length,
		avgLow: totalLow / observations.length,
		totalPrecipitation,
		hottestDate: hottestObservation.weatherDate,
		hottestTemperature: hottestObservation.maxTemperature,
		wettestDate: wettestObservation.weatherDate,
		wettestPrecipitation: wettestObservation.precipitation
	};
}
