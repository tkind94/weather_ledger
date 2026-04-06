<script lang="ts">
	import { coordinateLabel, type KnownLocation } from '$lib/weather';

	type SearchSubmitHandler = (event: SubmitEvent) => void | Promise<void>;
	type SearchInputHandler = (event: Event) => void;
	type LocationSelectHandler = (location: KnownLocation) => void | Promise<void>;
	type PendingLocationJob = {
		jobId: string;
		label: string;
		status: 'queued' | 'running' | 'succeeded' | 'failed';
	};

	let {
		selectedLocation,
		searchQuery,
		searchResults,
		searchBusy = false,
		pendingLocationJobs = [],
		statusMessage = null,
		onSearchInput,
		onSearchSubmit,
		onSelectLocation
	}: {
		selectedLocation: KnownLocation | null;
		searchQuery: string;
		searchResults: KnownLocation[];
		searchBusy?: boolean;
		pendingLocationJobs?: PendingLocationJob[];
		statusMessage?: string | null;
		onSearchInput: SearchInputHandler;
		onSearchSubmit: SearchSubmitHandler;
		onSelectLocation: LocationSelectHandler;
	} = $props();

	const noMatches = $derived(
		statusMessage === null &&
			searchQuery.trim().length >= 2 &&
			searchResults.length === 0 &&
			searchQuery.trim() !== selectedLocation?.canonicalName
	);
</script>

<section class="panel control-panel">
	<div class="panel-heading">
		<div>
			<p class="panel-kicker">Cache</p>
			<h2>Search what you already have</h2>
		</div>
	</div>

	<form class="search-form" onsubmit={onSearchSubmit}>
		<label class="search-label" for="location-search">Cached locations</label>
		<div class="search-row">
			<input
				id="location-search"
				type="search"
				value={searchQuery}
				oninput={onSearchInput}
				placeholder="Search cached locations"
				autocomplete="off"
			/>
			<button type="submit" disabled={searchResults.length === 0}>Open</button>
		</div>
	</form>

	{#if searchBusy}
		<p class="search-note">Searching your local cache...</p>
	{:else if noMatches}
		<p class="search-note">No cached locations match. Click the map to add a new one.</p>
	{/if}

	{#if searchResults.length > 0}
		<div class="results" role="listbox" aria-label="Cached locations">
			{#each searchResults as location (location.locationKey)}
				<button type="button" class="result-card" onclick={() => onSelectLocation(location)}>
					<strong>{location.canonicalName}</strong>
					<span>{location.observationCount} days cached</span>
					<span>{coordinateLabel(location.latitude, location.longitude)}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if pendingLocationJobs.length > 0}
		<div class="queued-jobs" aria-live="polite">
			<p class="panel-kicker">Queue</p>
			{#each pendingLocationJobs as job (job.jobId)}
				<div class="job-card">
					<strong>{job.label}</strong>
					<span
						>{job.status === 'queued' ? 'Queued for fetch' : 'Refreshing dashboard snapshot'}</span
					>
				</div>
			{/each}
		</div>
	{/if}

	<div class="selected-summary">
		<p class="panel-kicker">Selected</p>
		{#if selectedLocation}
			<h3>{selectedLocation.canonicalName}</h3>
			<p>{coordinateLabel(selectedLocation.latitude, selectedLocation.longitude)}</p>
			<p>
				{selectedLocation.latestObservationDate
					? `Latest observation: ${selectedLocation.latestObservationDate}`
					: 'No observations cached yet.'}
			</p>
		{:else}
			<h3>No location selected yet</h3>
			<p>Use the map to create your first cached location.</p>
		{/if}
	</div>

	{#if statusMessage}
		<p class="status-message" aria-live="polite">{statusMessage}</p>
	{/if}
</section>

<style>
	.panel {
		padding: 1.3rem;
		border-radius: 1.5rem;
		border: 1px solid rgba(15, 23, 32, 0.08);
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(18px);
		box-shadow: 0 1.25rem 3rem rgba(15, 23, 32, 0.06);
	}

	.control-panel {
		align-self: start;
	}

	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
		margin-bottom: 1rem;
	}

	.panel-kicker {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #0b7285;
	}

	h2,
	h3 {
		margin: 0;
		font-family: 'Iowan Old Style', 'Palatino Linotype', serif;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #102033;
	}

	h2 {
		font-size: 1.6rem;
	}

	h3 {
		font-size: 1.35rem;
	}

	.search-form {
		display: grid;
		gap: 0.5rem;
	}

	.search-label {
		font-size: 0.9rem;
		color: #536476;
	}

	.search-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.65rem;
	}

	.search-row input {
		width: 100%;
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		border: 1px solid rgba(16, 32, 51, 0.12);
		background: rgba(255, 255, 255, 0.92);
		font: inherit;
		color: #102033;
	}

	.search-row button,
	.result-card {
		font: inherit;
	}

	.search-row button {
		padding: 0.55rem 0.95rem;
		border-radius: 999px;
		border: 1px solid rgba(16, 32, 51, 0.12);
		background: rgba(255, 255, 255, 0.88);
		color: #102033;
	}

	.search-row button:disabled {
		opacity: 0.5;
	}

	.search-note,
	.status-message,
	.selected-summary p {
		margin: 0.75rem 0 0;
		color: #4d5c6c;
		line-height: 1.5;
	}

	.results {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	.queued-jobs {
		display: grid;
		gap: 0.7rem;
		margin-top: 1rem;
		padding: 0.95rem 1rem;
		border-radius: 1rem;
		background: rgba(11, 114, 133, 0.08);
	}

	.job-card {
		display: grid;
		gap: 0.15rem;
	}

	.job-card strong {
		font-size: 0.95rem;
		color: #102033;
	}

	.job-card span {
		font-size: 0.86rem;
		color: #4d5c6c;
	}

	.result-card {
		display: grid;
		gap: 0.2rem;
		padding: 0.95rem 1rem;
		text-align: left;
		border-radius: 1rem;
		border: 1px solid rgba(16, 32, 51, 0.08);
		background: rgba(255, 248, 240, 0.94);
		color: #102033;
	}

	.result-card strong {
		font-size: 1rem;
	}

	.result-card span {
		font-size: 0.88rem;
		color: #5a6b7d;
	}

	.selected-summary {
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(16, 32, 51, 0.08);
	}

	@media (max-width: 900px) {
		.panel-heading {
			flex-direction: column;
			align-items: start;
		}

		.search-row {
			grid-template-columns: 1fr;
		}
	}
</style>
