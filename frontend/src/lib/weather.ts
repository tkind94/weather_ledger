export type WeatherObservation = {
	weatherDate: string;
	latitude: number;
	longitude: number;
	timezone: string;
	maxTemperatureC: number;
	precipitationMm: number;
	source: string;
	fetchedAt: string;
};