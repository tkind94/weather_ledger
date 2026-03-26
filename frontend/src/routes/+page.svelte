<svelte:head>
	<title>Weather Ledger</title>
	<meta
		name="description"
		content="Local-first weather history for Fort Collins, Colorado powered by SvelteKit, DuckDB, and Open-Meteo."
	/>
</svelte:head>

<script lang="ts">
	import WeatherHistoryChart from '$lib/components/WeatherHistoryChart.svelte';

	import type { WeatherObservation, DashboardSummary } from '$lib/weather';

	let { data }: { data: { observations: WeatherObservation[]; summary: DashboardSummary | null } } =
		$props();

	let observations = $derived(data.observations);
	let summary = $derived(data.summary);
</script>

<section class="shell">
	<div class="hero">
		<p class="eyebrow">Weather Ledger</p>
		<h1>Fort Collins weather history, stored locally.</h1>
		<div class="hero-meta">
			<span>40.5852 N, 105.0844 W</span>
			<span>{observations.length} daily observations</span>
			<span>Source: Open-Meteo</span>
		</div>
	</div>

	<div class="metrics">
		<article class="metric-card">
			<p>Total precipitation</p>
			<strong>{summary?.totalPrecipitationMm.toFixed(1) ?? '—'} mm</strong>
		</article>
		<article class="metric-card">
			<p>Average high</p>
			<strong>{summary?.avgHighC.toFixed(1) ?? '—'} C</strong>
		</article>
		<article class="metric-card">
			<p>Monthly high</p>
			<strong>{summary?.monthlyHighC?.toFixed(1) ?? '—'} C</strong>
		</article>
		<article class="metric-card">
			<p>Wettest day</p>
			<strong>{summary?.wettestDate ?? '—'}</strong>
			<span>{summary?.wettestPrecipitationMm ? `${summary.wettestPrecipitationMm.toFixed(1)} mm` : ''}</span>
		</article>
	</div>

	{#if observations.length > 0}
		<section class="panel chart-panel">
			<div class="panel-heading">
				<div>
					<p class="panel-kicker">Trend</p>
					<h2>Precipitation versus max temperature</h2>
				</div>
			</div>
			<WeatherHistoryChart observations={observations} />
		</section>

		<section class="panel table-panel">
			<div class="panel-heading">
				<div>
					<p class="panel-kicker">History</p>
					<h2>Daily observations</h2>
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
								<td>{observation.maxTemperatureC.toFixed(1)} C</td>
								<td>{observation.precipitationMm.toFixed(1)} mm</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else}
		<section class="panel empty-state">
			<h2>No observations loaded yet.</h2>
			<p>Weather data has not been loaded yet.</p>
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
		padding: 2rem;
		border: 1px solid rgba(15, 23, 32, 0.08);
		border-radius: 1.75rem;
		background:
			linear-gradient(135deg, rgba(11, 114, 133, 0.14), rgba(255, 255, 255, 0.84)),
			radial-gradient(circle at top right, rgba(217, 108, 6, 0.18), transparent 38%),
			rgba(255, 255, 255, 0.72);
		box-shadow: 0 1.5rem 4rem rgba(15, 23, 32, 0.08);
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
		.panel-heading {
			flex-direction: column;
			align-items: start;
		}
	}
</style>
