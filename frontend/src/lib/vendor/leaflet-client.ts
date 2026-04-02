import type { CircleMarker, LeafletMouseEvent, Map } from 'leaflet';

export type LeafletModule = typeof import('leaflet');
export type LeafletMap = Map;
export type LeafletCircleMarker = CircleMarker;
export type { LeafletMouseEvent };

export function loadLeaflet(): Promise<LeafletModule> {
	return import('leaflet');
}
