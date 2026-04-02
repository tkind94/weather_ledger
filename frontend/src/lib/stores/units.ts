import { writable } from 'svelte/store';

export type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'weather_units_system';

function getInitial(): UnitSystem {
	if (typeof window === 'undefined') return 'metric';
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'imperial' ? 'imperial' : 'metric';
}

export const unitSystem = writable<UnitSystem>(getInitial());

if (typeof window !== 'undefined') {
	unitSystem.subscribe((value) => {
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			// ignore storage errors
		}
	});
}

export function convertTemp(c: number, system: UnitSystem): number {
	return system === 'imperial' ? (c * 9) / 5 + 32 : c;
}

export function convertPrecip(mm: number, system: UnitSystem): number {
	return system === 'imperial' ? mm / 25.4 : mm;
}

const TEMP_SUFFIX: Record<UnitSystem, string> = { metric: '°C', imperial: '°F' };
const PRECIP_SUFFIX: Record<UnitSystem, string> = { metric: 'mm', imperial: 'in' };

function formatTemp(c: number, system: UnitSystem): string {
	return `${convertTemp(c, system).toFixed(1)} ${TEMP_SUFFIX[system]}`;
}

function formatPrecip(mm: number, system: UnitSystem): string {
	const value = convertPrecip(mm, system);
	const suffix = PRECIP_SUFFIX[system];
	if (value === 0) return `0.00 ${suffix}`;
	if (value > 0 && value < 0.01) return `<0.01 ${suffix}`;
	return `${value.toFixed(2)} ${suffix}`;
}

export const fmt = {
	temp: formatTemp,
	precip: formatPrecip
};
