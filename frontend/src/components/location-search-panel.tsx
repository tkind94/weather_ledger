'use client';

import type { ReactNode } from 'react';
import { useDeferredValue, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
	buildLocationLabel,
	formatDateRange,
	formatTimestamp,
	type LocationCandidate,
	type LocationRecord,
	type LocationSeed
} from '@/lib/weather';

import styles from './location-search-panel.module.css';

type Props = {
	cachedLocations: LocationRecord[];
	selectedLocation: LocationRecord | null;
};

type SearchResponse = {
	locations: LocationCandidate[];
};

function locationPayload(location: LocationSeed): { location: LocationSeed } {
	return { location };
}

async function readError(response: Response): Promise<string> {
	try {
		const payload = (await response.json()) as { error?: string; message?: string };
		return payload.error ?? payload.message ?? 'Request failed.';
	} catch {
		return response.statusText || 'Request failed.';
	}
}

export function LocationSearchPanel({ cachedLocations, selectedLocation }: Props): ReactNode {
	const router = useRouter();
	const [query, setQuery] = useState('');
	const deferredQuery = useDeferredValue(query);
	const trimmedQuery = deferredQuery.trim();
	const [results, setResults] = useState<LocationCandidate[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isSearching, setIsSearching] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isNavigating, startTransition] = useTransition();
	const activeSearchController = useRef<AbortController | null>(null);
	const latestSearchQuery = useRef(trimmedQuery);

	latestSearchQuery.current = trimmedQuery;

	useEffect(() => {
		if (trimmedQuery.length < 2) {
			activeSearchController.current?.abort();
			activeSearchController.current = null;
			setResults([]);
			setError(null);
			setIsSearching(false);
			return;
		}

		const controller = new AbortController();
		activeSearchController.current?.abort();
		activeSearchController.current = controller;
		setIsSearching(true);

		void fetch(`/api/locations/search?q=${encodeURIComponent(trimmedQuery)}`, {
			signal: controller.signal,
			cache: 'no-store'
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(await readError(response));
				}

				const payload = (await response.json()) as SearchResponse;
				if (!controller.signal.aborted && latestSearchQuery.current === trimmedQuery) {
					setResults(payload.locations);
					setError(null);
				}
			})
			.catch((fetchError) => {
				if (controller.signal.aborted || latestSearchQuery.current !== trimmedQuery) {
					return;
				}

				setResults([]);
				setError(
					fetchError instanceof Error
						? fetchError.message
						: 'Unable to search Open-Meteo right now.'
				);
			})
			.finally(() => {
				if (
					!controller.signal.aborted &&
					activeSearchController.current === controller &&
					latestSearchQuery.current === trimmedQuery
				) {
					activeSearchController.current = null;
					setIsSearching(false);
				}
			});

		return () => {
			controller.abort();
			if (activeSearchController.current === controller) {
				activeSearchController.current = null;
			}
		};
	}, [trimmedQuery]);

	function openLocation(locationKey: string): void {
		startTransition(() => {
			router.push(`/?location=${encodeURIComponent(locationKey)}`);
		});
	}

	function refreshCurrentLocation(): void {
		startTransition(() => {
			router.refresh();
		});
	}

	async function cacheLocation(location: LocationSeed): Promise<void> {
		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch('/api/locations', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify(locationPayload(location))
			});

			if (!response.ok) {
				throw new Error(await readError(response));
			}

			const payload = (await response.json()) as { location: LocationRecord };

			setQuery('');
			setResults([]);
			if (selectedLocation?.locationKey === payload.location.locationKey) {
				refreshCurrentLocation();
			} else {
				openLocation(payload.location.locationKey);
			}
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: 'Unable to cache that location right now.'
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	const busy = isSearching || isSubmitting || isNavigating;

	return (
		<div className={styles.panel}>
			<div className={styles.block}>
				<p className={styles.eyebrow}>Explore</p>
				<h2 className={styles.title}>Add or reopen a place</h2>
				<p className={styles.copy}>
					Search Open-Meteo directly, cache the response into SQLite, and reopen any stored city
					without rerunning a pipeline.
				</p>
			</div>

			<div className={styles.block}>
				<label className={styles.searchLabel} htmlFor="location-query">
					Search locations
				</label>
				<input
					id="location-query"
					autoComplete="off"
					placeholder="Try Reykjavik, Tokyo, or Nairobi"
					value={query}
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
				<div className={styles.statusRow}>
					<span>
						{busy
							? 'Working…'
							: trimmedQuery.length >= 2 && results.length === 0 && !error
								? `No locations found for '${trimmedQuery}'`
								: 'Type at least two characters to search.'}
					</span>
					{selectedLocation ? (
						<button
							className={styles.secondaryButton}
							disabled={busy}
							onClick={() => void cacheLocation(selectedLocation)}
							type="button"
						>
							Refresh current cache
						</button>
					) : null}
				</div>

				{error ? <p className={styles.error}>{error}</p> : null}

				{results.length > 0 ? (
					<div className={styles.resultList}>
						{results.map((location) => (
							<button
								className={styles.resultCard}
								disabled={busy}
								key={location.locationKey}
								onClick={() =>
									location.isCached
										? openLocation(location.locationKey)
										: void cacheLocation(location)
								}
								type="button"
							>
								<span className={styles.resultName}>{location.displayName}</span>
								<span className={styles.resultMeta}>
									{location.isCached ? 'Already cached' : 'Fetch and cache'}
								</span>
							</button>
						))}
					</div>
				) : null}
			</div>

			<div className={styles.block}>
				<div className={styles.blockHeader}>
					<p className={styles.eyebrow}>Cache</p>
					<p className={styles.cacheCount}>{cachedLocations.length} stored</p>
				</div>
				<div className={styles.cachedList}>
					{cachedLocations.map((location) => {
						const isSelected = selectedLocation?.locationKey === location.locationKey;
						return (
							<button
								className={isSelected ? styles.cachedCardSelected : styles.cachedCard}
								key={location.locationKey}
								onClick={() => openLocation(location.locationKey)}
								type="button"
							>
								<span className={styles.resultName}>{buildLocationLabel(location)}</span>
								<span className={styles.cachedMeta}>
									{location.observationCount} days ·{' '}
									{formatDateRange(location.firstObservationDate, location.latestObservationDate)}
								</span>
								<span className={styles.cachedMeta}>
									Updated {formatTimestamp(location.lastFetchedAt)}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
