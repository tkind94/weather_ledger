import { describe, expect, test } from 'bun:test';

import {
	buildLocationKey,
	buildLocationLabel,
	canonicalizeLocationSeed,
	coordinateLabel,
	formatDate,
	formatTimestamp,
	summarizeObservations
} from './weather';

describe('weather helpers', () => {
	test('buildLocationLabel omits missing parts', () => {
		expect(
			buildLocationLabel({ name: 'Fort Collins', admin1: 'Colorado', country: 'United States' })
		).toBe('Fort Collins, Colorado, United States');

		expect(buildLocationLabel({ name: 'Reykjavik', admin1: null, country: 'Iceland' })).toBe(
			'Reykjavik, Iceland'
		);
	});

	test('buildLocationKey keeps locations stable across fetches', () => {
		expect(
			buildLocationKey({
				name: 'Fort Collins',
				admin1: 'Colorado',
				country: 'United States',
				latitude: 40.5852,
				longitude: -105.0844
			})
		).toBe('fort-collins-colorado-united-states-40-585-m105-084');
	});

	test('canonicalizeLocationSeed keeps a human-readable display name', () => {
		expect(
			canonicalizeLocationSeed({
				name: 'Boulder',
				admin1: 'Colorado',
				country: 'United States',
				latitude: 40.123456,
				longitude: -105.987654,
				timezone: 'America/Denver'
			})
		).toEqual({
			locationKey: '40.1235,-105.9877',
			displayName: 'Boulder, Colorado, United States',
			name: 'Boulder',
			admin1: 'Colorado',
			country: 'United States',
			latitude: 40.1235,
			longitude: -105.9877,
			timezone: 'America/Denver'
		});
	});

	test('coordinateLabel formats cardinal directions', () => {
		expect(coordinateLabel(-33.868, 151.209)).toBe('33.868° S, 151.209° E');
	});

	test('formatters render in UTC for stable server and client output', () => {
		expect(formatDate('2026-04-08')).toBe('Apr 8, 2026');
		expect(formatTimestamp('2026-04-08T23:30:00.000Z')).toBe('Apr 8, 11:30 PM');
	});

	test('summarizeObservations aggregates a simple series', () => {
		const summary = summarizeObservations([
			{
				weatherDate: '2026-04-01',
				maxTemperature: 18,
				minTemperature: 5,
				precipitation: 0
			},
			{
				weatherDate: '2026-04-02',
				maxTemperature: 22,
				minTemperature: 8,
				precipitation: 2.5
			}
		]);

		expect(summary.observationCount).toBe(2);
		expect(summary.avgHigh).toBe(20);
		expect(summary.avgLow).toBe(6.5);
		expect(summary.totalPrecipitation).toBe(2.5);
		expect(summary.hottestDate).toBe('2026-04-02');
		expect(summary.wettestDate).toBe('2026-04-02');
	});
});
