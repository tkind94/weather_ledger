<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import { onMount } from 'svelte';

	import {
		loadLeaflet,
		type LeafletCircleMarker,
		type LeafletMap,
		type LeafletModule,
		type LeafletMouseEvent
	} from '$lib/vendor/leaflet-client';
	import type { KnownLocation } from '$lib/weather';

	type Coordinates = {
		latitude: number;
		longitude: number;
	};

	let {
		selectedLocation,
		onPick,
		disabled = false
	}: {
		selectedLocation: KnownLocation | null;
		onPick: (coordinates: Coordinates) => void;
		disabled?: boolean;
	} = $props();

	let mapElement: HTMLDivElement;
	let leaflet: LeafletModule | null = null;
	let map: LeafletMap | null = null;
	let marker: LeafletCircleMarker | null = null;
	let lastLocationKey: string | null = null;

	function selectedMarkerState(): {
		coordinates: [number, number] | null;
		locationKey: string | null;
	} {
		if (selectedLocation === null) {
			return { coordinates: null, locationKey: null };
		}

		return {
			coordinates: [selectedLocation.latitude, selectedLocation.longitude],
			locationKey: selectedLocation.locationKey
		};
	}

	function syncMarker(coordinates: [number, number] | null, locationKey: string | null): void {
		if (map === null || leaflet === null) {
			return;
		}

		if (coordinates === null) {
			marker?.remove();
			marker = null;
			lastLocationKey = null;
			return;
		}

		if (marker === null) {
			marker = leaflet
				.circleMarker(coordinates, {
					radius: 10,
					color: '#f76707',
					weight: 3,
					fillColor: '#ffe8cc',
					fillOpacity: 0.9
				})
				.addTo(map);
		} else {
			marker.setLatLng(coordinates);
		}

		if (locationKey !== null && lastLocationKey !== locationKey) {
			map.setView(coordinates, 8);
			lastLocationKey = locationKey;
		}
	}

	onMount(() => {
		void (async () => {
			const initialMarker = selectedMarkerState();
			leaflet = await loadLeaflet();
			map = leaflet
				.map(mapElement, {
					zoomControl: true,
					attributionControl: true
				})
				.setView(
					initialMarker.coordinates ?? [39.8283, -98.5795],
					initialMarker.locationKey ? 8 : 4
				);

			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					maxZoom: 14,
					attribution: '&copy; OpenStreetMap contributors'
				})
				.addTo(map);

			map.on('click', (event: LeafletMouseEvent) => {
				if (!disabled) {
					onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
				}
			});

			syncMarker(initialMarker.coordinates, initialMarker.locationKey);
		})();

		return () => {
			map?.remove();
			map = null;
			marker = null;
			leaflet = null;
		};
	});

	$effect(() => {
		const markerState = selectedMarkerState();
		syncMarker(markerState.coordinates, markerState.locationKey);
	});
</script>

<div class="map-shell">
	<div bind:this={mapElement} class:disabled class="map" aria-label="Location picker map"></div>
	<div class="map-caption">
		<span>Click anywhere to add a new cached location.</span>
		<span>Existing places stay local and searchable.</span>
	</div>
</div>

<style>
	.map-shell {
		display: grid;
		gap: 0.85rem;
	}

	.map {
		height: 22rem;
		border-radius: 1.4rem;
		border: 1px solid rgba(16, 32, 51, 0.12);
		overflow: hidden;
	}

	.map.disabled {
		filter: saturate(0.75);
		cursor: progress;
	}

	.map-caption {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		font-size: 0.92rem;
		color: #4d5c6c;
	}

	.map-caption span {
		padding: 0.5rem 0.8rem;
		border-radius: 999px;
		background: rgba(255, 248, 240, 0.9);
		border: 1px solid rgba(16, 32, 51, 0.08);
	}
</style>
