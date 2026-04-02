import { describe, expect, it } from 'vitest';
import { convertTemp, convertPrecip, fmt } from './units';

describe('convertTemp', () => {
	it('returns Celsius unchanged for metric', () => {
		expect.assertions(2);
		expect(convertTemp(0, 'metric')).toBe(0);
		expect(convertTemp(100, 'metric')).toBe(100);
	});

	it('converts Celsius to Fahrenheit for imperial', () => {
		expect.assertions(3);
		expect(convertTemp(0, 'imperial')).toBe(32);
		expect(convertTemp(100, 'imperial')).toBe(212);
		expect(convertTemp(-40, 'imperial')).toBe(-40);
	});
});

describe('convertPrecip', () => {
	it('returns mm unchanged for metric', () => {
		expect.assertions(1);
		expect(convertPrecip(25.4, 'metric')).toBe(25.4);
	});

	it('converts mm to inches for imperial', () => {
		expect.assertions(2);
		expect(convertPrecip(25.4, 'imperial')).toBeCloseTo(1.0, 5);
		expect(convertPrecip(0, 'imperial')).toBe(0);
	});
});

describe('fmt.temp', () => {
	it('formats metric with °C suffix', () => {
		expect.assertions(1);
		expect(fmt.temp(15.2, 'metric')).toBe('15.2 °C');
	});

	it('formats imperial with °F suffix', () => {
		expect.assertions(1);
		expect(fmt.temp(0, 'imperial')).toBe('32.0 °F');
	});
});

describe('fmt.precip', () => {
	it('formats zero correctly for both systems', () => {
		expect.assertions(2);
		expect(fmt.precip(0, 'metric')).toBe('0.00 mm');
		expect(fmt.precip(0, 'imperial')).toBe('0.00 in');
	});

	it('shows trace imperial amounts as <0.01', () => {
		expect.assertions(1);
		// 0.2mm / 25.4 = 0.00787… which is >0 and <0.01
		expect(fmt.precip(0.2, 'imperial')).toBe('<0.01 in');
	});

	it('formats normal amounts to two decimal places', () => {
		expect.assertions(2);
		expect(fmt.precip(2.3, 'metric')).toBe('2.30 mm');
		expect(fmt.precip(25.4, 'imperial')).toBe('1.00 in');
	});
});
