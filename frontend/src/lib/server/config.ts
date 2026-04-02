export const defaultLocation = {
	key: process.env.WEATHER_LEDGER_DEFAULT_LOCATION_KEY ?? 'fort-collins-colorado-us',
	name: process.env.WEATHER_LEDGER_DEFAULT_LOCATION_NAME ?? 'Fort Collins, Colorado, United States',
	latitude: process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LATITUDE ?? '40.5852',
	longitude: process.env.WEATHER_LEDGER_DEFAULT_LOCATION_LONGITUDE ?? '-105.0844',
	timezone: process.env.WEATHER_LEDGER_DEFAULT_LOCATION_TIMEZONE ?? 'America/Denver'
} as const;
