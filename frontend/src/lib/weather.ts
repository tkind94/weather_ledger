export type WeatherObservation = {
	weatherDate: string;
	maxTemperature: number;
	precipitation: number;
};

export type DashboardSummary = {
	locationKey: string;
	observationCount: number;
	totalPrecipitation: number;
	avgHigh: number;
	wettestDate: string | null;
	wettestPrecipitation: number | null;
	monthlyHigh: number | null;
};

export type KnownLocation = {
	locationKey: string;
	canonicalName: string;
	admin1: string | null;
	country: string | null;
	latitude: number;
	longitude: number;
	timezone: string;
	observationCount: number;
	firstObservationDate: string | null;
	latestObservationDate: string | null;
	lastFetchedAt: string | null;
};

export type DashboardPageData = {
	selectedLocation: KnownLocation | null;
	observations: WeatherObservation[];
	summary: DashboardSummary | null;
	locationCount: number;
};

export function coordinateLabel(latitude: number, longitude: number): string {
	const northSouth = latitude >= 0 ? 'N' : 'S';
	const eastWest = longitude >= 0 ? 'E' : 'W';
	return `${Math.abs(latitude).toFixed(3)}° ${northSouth}, ${Math.abs(longitude).toFixed(3)}° ${eastWest}`;
}
