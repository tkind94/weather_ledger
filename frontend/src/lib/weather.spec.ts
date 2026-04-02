import { describe, expect, it } from 'vitest';
import { coordinateLabel } from './weather';

describe('coordinateLabel', () => {
	it('formats positive lat and negative lon as N and W', () => {
		expect.assertions(1);
		expect(coordinateLabel(40.585, -105.084)).toBe('40.585° N, 105.084° W');
	});

	it('formats negative lat and positive lon as S and E', () => {
		expect.assertions(1);
		expect(coordinateLabel(-33.868, 151.209)).toBe('33.868° S, 151.209° E');
	});

	it('formats zero coordinates as N and E', () => {
		expect.assertions(1);
		expect(coordinateLabel(0, 0)).toBe('0.000° N, 0.000° E');
	});
});
