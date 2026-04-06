<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import LocationSearchPanel from '$lib/components/LocationSearchPanel.svelte';
	import LocationPickerMap from '$lib/components/LocationPickerMap.svelte';
	import WeatherHistoryChart from '$lib/components/WeatherHistoryChart.svelte';

	import { coordinateLabel, type DashboardPageData, type KnownLocation } from '$lib/weather';
	import { unitSystem, fmt } from '$lib/stores/units';

	type SearchResponse = {
		locations: KnownLocation[];
	};

	type LocationJobLocation = {
		locationKey: string;
		canonicalName: string;
		rowsStored: number;
		existingLocation: boolean;
	};

	type LocationJobResponse = {
		jobId: string;
		latitude: number;
		longitude: number;
		status: 'queued' | 'running' | 'succeeded' | 'failed';
		createdAt: string;
		updatedAt: string;
		startedAt: string | null;
		finishedAt: string | null;
		location: LocationJobLocation | null;
		message: string | null;
		partialSuccess: boolean;
	};

	type EnqueueResponse = {
		job: LocationJobResponse;
	};

	type LocationJobStatusResponse = {
		job: LocationJobResponse;
	};

	type PendingLocationJob = {
		jobId: string;
		label: string;
		status: 'queued' | 'running' | 'succeeded' | 'failed';
	};

	type EnsureResponse = {
		location: {
			locationKey: string;
			canonicalName: string;
			rowsStored: number;
			existingLocation: boolean;
		};
	};

	type ApiErrorResponse = {
		message: string;
		partialSuccess: boolean;
	};

	let { data }: { data: DashboardPageData } = $props();

	let selectedLocation = $derived(data.selectedLocation);
	let observations = $derived(data.observations);
	let summary = $derived(data.summary);
	let locationCount = $derived(data.locationCount);

	let searchInput = $state<string | null>(null);
	let searchQuery = $derived(searchInput ?? selectedLocation?.canonicalName ?? '');
	let searchResults = $state<KnownLocation[]>([]);
	let searchBusy = $state(false);
	let submittingLocation = $state(false);
	let statusMessage = $state<string | null>(null);
	let pendingLocationJobs = $state<LocationJobResponse[]>([]);
	let activeMapJobId = $state<string | null>(null);
	let searchController: AbortController | null = null;
	const pollingJobIds = new SvelteSet<string>();
	let destroyed = false;

	const pendingLocationJobCards = $derived(
		pendingLocationJobs.map<PendingLocationJob>((job) => ({
			jobId: job.jobId,
			label: job.location?.canonicalName ?? coordinateLabel(job.latitude, job.longitude),
			status: job.status
		}))
	);

	onDestroy(() => {
		destroyed = true;
		pollingJobIds.clear();
	});

	function delay(ms: number): Promise<void> {
		return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
	}

	function isPendingLocationJob(job: LocationJobResponse): boolean {
		return job.status === 'queued' || job.status === 'running';
	}

	function replacePendingLocationJob(job: LocationJobResponse): void {
		if (!isPendingLocationJob(job)) {
			pendingLocationJobs = pendingLocationJobs.filter((item) => item.jobId !== job.jobId);
			return;
		}

		pendingLocationJobs = [
			...pendingLocationJobs.filter((item) => item.jobId !== job.jobId),
			job
		].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
	}

	function queuedLocationMessage(job: LocationJobResponse): string {
		return `Queued a background refresh for ${coordinateLabel(job.latitude, job.longitude)}. We'll open it automatically when the dashboard is ready.`;
	}

	function runningLocationMessage(job: LocationJobResponse): string {
		if (job.location !== null) {
			return `Refreshing the dashboard for ${job.location.canonicalName}...`;
		}

		return `Fetching weather data for ${coordinateLabel(job.latitude, job.longitude)} and rebuilding the dashboard...`;
	}

	function completionMessage(location: LocationJobLocation): string {
		return location.rowsStored > 0
			? `Cached ${location.rowsStored} new daily observations for ${location.canonicalName}.`
			: `${location.canonicalName} is already up to date.`;
	}

	async function pollLocationJob(jobId: string): Promise<void> {
		if (pollingJobIds.has(jobId)) {
			return;
		}

		pollingJobIds.add(jobId);

		try {
			while (!destroyed) {
				const response = await fetch(`/api/location-jobs/${encodeURIComponent(jobId)}`, {
					cache: 'no-store'
				});

				if (!response.ok) {
					const failure = await readErrorResponse(response);
					throw new Error(failure.message);
				}

				const payload = (await response.json()) as LocationJobStatusResponse;
				const job = payload.job;
				replacePendingLocationJob(job);

				if (job.status === 'queued') {
					if (activeMapJobId === job.jobId) {
						statusMessage = queuedLocationMessage(job);
					}

					await delay(400);
					continue;
				}

				if (job.status === 'running') {
					if (activeMapJobId === job.jobId) {
						statusMessage = runningLocationMessage(job);
					}

					await delay(400);
					continue;
				}

				pendingLocationJobs = pendingLocationJobs.filter((item) => item.jobId !== job.jobId);

				if (job.status === 'failed') {
					if (activeMapJobId === job.jobId) {
						activeMapJobId = null;
					}

					statusMessage = job.message ?? 'Unable to finish loading that location right now.';
					return;
				}

				if (job.location === null) {
					if (activeMapJobId === job.jobId) {
						activeMapJobId = null;
					}

					statusMessage = 'Location refresh completed.';
					return;
				}

				const message = completionMessage(job.location);
				if (activeMapJobId !== job.jobId) {
					statusMessage = `${job.location.canonicalName} is ready in your local cache.`;
					return;
				}

				statusMessage = message;
				searchResults = [];
				searchInput = job.location.canonicalName;
				activeMapJobId = null;
				let locationHref = resolve('/');
				locationHref += `?location=${encodeURIComponent(job.location.locationKey)}`;
				try {
					await goto(locationHref, { invalidateAll: true });
				} finally {
					searchInput = null;
				}

				return;
			}
		} catch (error) {
			pendingLocationJobs = pendingLocationJobs.filter((item) => item.jobId !== jobId);
			if (activeMapJobId === jobId) {
				activeMapJobId = null;
			}

			statusMessage =
				error instanceof Error ? error.message : 'Unable to monitor that location right now.';
		} finally {
			pollingJobIds.delete(jobId);
		}
	}

	async function readErrorResponse(response: Response): Promise<ApiErrorResponse> {
		const fallbackMessage = response.statusText || 'Request failed';

		try {
			const payload = await response.json();
			if (
				typeof payload === 'object' &&
				payload !== null &&
				'message' in payload &&
				typeof payload.message === 'string'
			) {
				return {
					message: payload.message,
					partialSuccess: 'partialSuccess' in payload && payload.partialSuccess === true
				};
			}
		} catch {
			// Fall through to default
		}

		return { message: fallbackMessage, partialSuccess: false };
	}

	async function selectKnownLocation(location: KnownLocation): Promise<void> {
		searchController?.abort();
		statusMessage = null;
		searchInput = location.canonicalName;
		searchResults = [];
		let locationHref = resolve('/');
		locationHref += `?location=${encodeURIComponent(location.locationKey)}`;
		try {
			await goto(locationHref);
		} finally {
			searchInput = null;
		}
	}

	async function submitSearch(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (searchResults[0]) {
			await selectKnownLocation(searchResults[0]);
		}
	}

	async function handleMapPick(coordinates: {
		latitude: number;
		longitude: number;
	}): Promise<void> {
		submittingLocation = true;
		searchController?.abort();
		searchController = null;
		searchResults = [];
		statusMessage = `Queueing a background refresh for ${coordinateLabel(coordinates.latitude, coordinates.longitude)}...`;

		try {
			const response = await fetch('/api/locations', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(coordinates)
			});

			if (!response.ok) {
				const failure = await readErrorResponse(response);
				throw new Error(failure.message);
			}

			const payload = (await response.json()) as EnqueueResponse;
			activeMapJobId = payload.job.jobId;
			replacePendingLocationJob(payload.job);
			statusMessage = queuedLocationMessage(payload.job);
			void pollLocationJob(payload.job.jobId);
		} catch (error) {
			statusMessage =
				error instanceof Error ? error.message : 'Unable to queue that location right now.';
		} finally {
			submittingLocation = false;
		}
	}

	function resetSearchResults(): void {
		searchController?.abort();
		searchController = null;
		searchResults = [];
		searchBusy = false;
	}

	async function requestSearchResults(query: string): Promise<void> {
		searchController?.abort();
		const controller = new AbortController();
		searchController = controller;
		searchBusy = true;

		try {
			const response = await fetch(`/api/locations?q=${encodeURIComponent(query)}`, {
				signal: controller.signal
			});

			if (!response.ok) {
				const failure = await readErrorResponse(response);
				throw new Error(failure.message);
			}

			const payload = (await response.json()) as SearchResponse;
			searchResults = payload.locations;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			searchResults = [];
			statusMessage = error instanceof Error ? error.message : 'Unable to search cached locations.';
		} finally {
			if (searchController === controller) {
				searchController = null;
				searchBusy = false;
			}
		}
	}

	function handleSearchInput(event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}

		searchInput = target.value;
		statusMessage = null;
		const normalized = target.value.trim();
		if (normalized.length < 2 || normalized === selectedLocation?.canonicalName) {
			resetSearchResults();
			return;
		}

		void requestSearchResults(normalized);
	}
</script>

<svelte:head>
	<title>Weather Ledger</title>
	<meta
		name="description"
		content="Local-first weather history for cached and on-demand locations powered by SvelteKit, DuckDB, dbt, and Open-Meteo."
	/>
</svelte:head>

<section class="shell">
	<div class="hero">
		<div>
			<p class="eyebrow">Weather Ledger</p>
			<h1>
				{selectedLocation
					? selectedLocation.canonicalName
					: 'Pick a place and build its local weather ledger.'}
			</h1>
			<p class="hero-copy">
				Search only the locations you have already cached, or click the map to ingest a new one on
				demand. Every new location is queued, fetched in the background, and folded into the next
				dbt rebuild before the dashboard refreshes.
			</p>
		</div>
		<div class="hero-meta">
			<span>{locationCount} cached {locationCount === 1 ? 'location' : 'locations'}</span>
			{#if selectedLocation}
				<span>{coordinateLabel(selectedLocation.latitude, selectedLocation.longitude)}</span>
				<span>{selectedLocation.observationCount} daily observations</span>
				<span>{selectedLocation.timezone}</span>
			{/if}
			<span>Source: Open-Meteo + dbt</span>
			<span class="unit-toggle">
				<button
					type="button"
					class:active={$unitSystem === 'metric'}
					onclick={() => unitSystem.set('metric')}>Metric</button
				>
				<button
					type="button"
					class:active={$unitSystem === 'imperial'}
					onclick={() => unitSystem.set('imperial')}>Imperial</button
				>
			</span>
		</div>
	</div>

	<div class="control-grid">
		<LocationSearchPanel
			{selectedLocation}
			{searchQuery}
			{searchResults}
			{searchBusy}
			{statusMessage}
			pendingLocationJobs={pendingLocationJobCards}
			onSearchInput={handleSearchInput}
			onSearchSubmit={submitSearch}
			onSelectLocation={selectKnownLocation}
		/>

		<section class="panel map-panel">
			<div class="panel-heading">
				<div>
					<p class="panel-kicker">Explore</p>
					<h2>Click the map for a new location</h2>
				</div>
			</div>
			<LocationPickerMap {selectedLocation} onPick={handleMapPick} disabled={submittingLocation} />
		</section>
	</div>

	<div class="metrics">
		<article class="metric-card">
			<p>Total precipitation</p>
			<strong>{summary ? fmt.precip(summary.totalPrecipitation, $unitSystem) : '—'}</strong>
		</article>
		<article class="metric-card">
			<p>Average high</p>
			<strong>{summary ? fmt.temp(summary.avgHigh, $unitSystem) : '—'}</strong>
		</article>
		<article class="metric-card">
			<p>Latest monthly high</p>
			<strong
				>{summary?.monthlyHigh != null ? fmt.temp(summary.monthlyHigh, $unitSystem) : '—'}</strong
			>
		</article>
		<article class="metric-card">
			<p>Wettest day</p>
			<strong>{summary?.wettestDate ?? '—'}</strong>
			<span
				>{summary?.wettestPrecipitation != null
					? fmt.precip(summary.wettestPrecipitation, $unitSystem)
					: ''}</span
			>
		</article>
	</div>

	{#if selectedLocation && observations.length > 0}
		<section class="panel chart-panel">
			<div class="panel-heading">
				<div>
					<p class="panel-kicker">Trend</p>
					<h2>{selectedLocation.canonicalName} precipitation versus max temperature</h2>
				</div>
			</div>
			<WeatherHistoryChart {observations} unitSystem={$unitSystem} />
		</section>

		<section class="panel table-panel">
			<div class="panel-heading">
				<div>
					<p class="panel-kicker">History</p>
					<h2>Daily observations for {selectedLocation.canonicalName}</h2>
				</div>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Max temp</th>
							<th>Precipitation</th>
						</tr>
					</thead>
					<tbody>
						{#each observations as observation (observation.weatherDate)}
							<tr>
								<td>{observation.weatherDate}</td>
								<td>{fmt.temp(observation.maxTemperature, $unitSystem)}</td>
								<td>{fmt.precip(observation.precipitation, $unitSystem)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else}
		<section class="panel empty-state">
			<h2>No observations loaded yet.</h2>
			<p>Choose an existing cached location or click the map to fetch one.</p>
		</section>
	{/if}
</section>

<style>
	.shell {
		max-width: 78rem;
		margin: 0 auto;
		padding: 3rem 1.25rem 4rem;
	}

	.hero {
		display: grid;
		gap: 1.35rem;
		padding: 2rem;
		border: 1px solid rgba(15, 23, 32, 0.08);
		border-radius: 1.75rem;
		background:
			linear-gradient(135deg, rgba(11, 114, 133, 0.16), rgba(255, 252, 246, 0.92)),
			radial-gradient(circle at top right, rgba(247, 103, 7, 0.2), transparent 34%),
			radial-gradient(circle at bottom left, rgba(128, 185, 24, 0.16), transparent 28%),
			rgba(255, 255, 255, 0.8);
		box-shadow: 0 1.5rem 4rem rgba(15, 23, 32, 0.08);
	}

	.hero-copy {
		margin: 1rem 0 0;
		max-width: 52rem;
		font-size: 1.04rem;
		line-height: 1.65;
		color: #314457;
	}

	.eyebrow,
	.panel-kicker {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #0b7285;
	}

	h1,
	h2 {
		margin: 0;
		font-family: 'Iowan Old Style', 'Palatino Linotype', serif;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #102033;
	}

	h1 {
		margin-top: 0.65rem;
		font-size: clamp(2.5rem, 5vw, 4.75rem);
		line-height: 0.98;
	}

	.hero-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.hero-meta span {
		padding: 0.55rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.74);
		border: 1px solid rgba(15, 23, 32, 0.08);
		font-size: 0.92rem;
	}

	.unit-toggle {
		display: inline-flex;
		gap: 0.4rem;
	}

	.unit-toggle button {
		font: inherit;
		padding: 0.55rem 0.95rem;
		border-radius: 999px;
		border: 1px solid rgba(16, 32, 51, 0.12);
		background: rgba(255, 255, 255, 0.88);
		color: #102033;
	}

	.unit-toggle button.active {
		background: #102033;
		color: #fff7ed;
	}

	.control-grid {
		display: grid;
		grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.metric-card,
	.panel {
		border-radius: 1.5rem;
		border: 1px solid rgba(15, 23, 32, 0.08);
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(18px);
		box-shadow: 0 1.25rem 3rem rgba(15, 23, 32, 0.06);
	}

	.map-panel {
		align-self: start;
	}

	.metric-card {
		padding: 1.25rem;
	}

	.metric-card p,
	.metric-card span,
	.panel-heading p,
	table {
		color: #425466;
	}

	.metric-card strong {
		display: block;
		margin: 0.3rem 0 0.15rem;
		font-size: 2rem;
		line-height: 1.1;
		color: #102033;
	}

	.metric-card span {
		display: block;
		margin-top: 0.35rem;
	}

	.panel {
		padding: 1.3rem;
	}

	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
		margin-bottom: 1rem;
	}

	.chart-panel,
	.table-panel {
		margin-top: 1.25rem;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.9rem 0.75rem;
		border-bottom: 1px solid rgba(15, 23, 32, 0.08);
		text-align: left;
	}

	thead th {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.empty-state {
		margin-top: 1.25rem;
		text-align: center;
	}

	@media (max-width: 900px) {
		.control-grid {
			grid-template-columns: 1fr;
		}

		.panel-heading {
			flex-direction: column;
			align-items: start;
		}
	}
</style>
