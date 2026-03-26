export type WeatherObservation = {
	weatherDate: string;
	maxTemperature: number;
	precipitation: number;
};

export type DashboardSummary = {
	observationCount: number;
	totalPrecipitation: number;
	avgHigh: number;
	wettestDate: string | null;
	wettestPrecipitation: number | null;
	monthlyHigh: number | null;
};
