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

export const fmt = {
	temp: (c: number, u: UnitSystem): string =>
		u === 'imperial' ? `${(c * 9 / 5 + 32).toFixed(1)} °F` : `${c.toFixed(1)} °C`,
	precip: (mm: number, u: UnitSystem): string =>
		u === 'imperial' ? `${(mm / 25.4).toFixed(1)} in` : `${mm.toFixed(1)} mm`,
};
