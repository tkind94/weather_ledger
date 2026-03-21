export type WeatherObservation = {
	weatherDate: string;
	latitude: number;
	longitude: number;
	timezone: string;
	maxTemperatureC: number;
	minTemperatureC: number;
	avgTemperatureC: number;
	precipitationMm: number;
	windSpeedKph: number;
	windGustKph: number;
	windDirectionDeg: number;
	pressureHpa: number;
	source: string;
	fetchedAt: string;
};

export type MonthlyExtremeRow = {
	month: string;
	latitude: number;
	longitude: number;
	monthly_max_c: number;
	monthly_min_c: number;
};
