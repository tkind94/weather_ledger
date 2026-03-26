export type WeatherObservation = {
	weatherDate: string;
	maxTemperatureC: number;
	precipitationMm: number;
};

export type DashboardSummary = {
	observationCount: number;
	totalPrecipitationMm: number;
	avgHighC: number;
	wettestDate: string | null;
	wettestPrecipitationMm: number | null;
	monthlyHighC: number | null;
};
