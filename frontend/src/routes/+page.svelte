<svelte:head>
	<title>Weather Ledger</title>
	<meta
		name="description"
		content="Local-first weather history for Fort Collins, Colorado powered by SvelteKit, DuckDB, and Open-Meteo."
	/>
</svelte:head>

<script lang="ts">
	import WeatherHistoryChart from '$lib/components/WeatherHistoryChart.svelte';

	import type { WeatherObservation } from '$lib/weather';

	let { data }: { data: { observations: WeatherObservation[] } } = $props();

	let observations = $derived(data.observations);
	let observationCount = $derived(observations.length);
	let totalPrecipitation = $derived(
		observations.reduce((total, observation) => total + observation.precipitationMm, 0)
	);
	let averageHigh = $derived(
		observationCount
			? observations.reduce((total, observation) => total + observation.maxTemperatureC, 0) /
					observationCount
			: 0
	);
	let hottestDay = $derived(
		observationCount
			? observations.reduce((current, observation) =>
					observation.maxTemperatureC > current.maxTemperatureC ? observation : current
				)
			: null
	);
	let wettestDay = $derived(
		observationCount
			? observations.reduce((current, observation) =>
					observation.precipitationMm > current.precipitationMm ? observation : current
				)
			: null
	);
</script>

<section class="shell">
	<div class="hero">
		<p class="eyebrow">Weather Ledger</p>
		<h1>Fort Collins weather history, stored locally.</h1>
		<p class="lede">
			A proof of concept that ingests Open-Meteo observations into DuckDB, exposes them through
			SvelteKit server loads, and renders the result with Apache ECharts.
		</p>
		<div class="hero-meta">
			<span>40.5852 N, 105.0844 W</span>
			<span>{observationCount} daily observations loaded</span>
			<span>Source: Open-Meteo Historical API</span>
		</div>
	</div>

	<div class="metrics">
		<article class="metric-card">
			<p>Total precipitation</p>
			<strong>{totalPrecipitation.toFixed(1)} mm</strong>
			<span>Across the most recent 7 complete days</span>
		</article>
		<article class="metric-card">
			<p>Average daily high</p>
			<strong>{averageHigh.toFixed(1)} C</strong>
			<span>Seven-day rolling baseline for the POC</span>
		</article>
		<article class="metric-card">
			<p>Wettest day</p>
			<strong>{wettestDay ? wettestDay.weatherDate : 'Pending'}</strong>
			<span>{wettestDay ? `${wettestDay.precipitationMm.toFixed(1)} mm` : 'Run the fetch job'}</span>
		</article>
	</div>

	{#if observationCount > 0}
		<div class="insight-grid">
			<section class="panel chart-panel">
				<div class="panel-heading">
					<div>
						<p class="panel-kicker">Trend</p>
						<h2>Precipitation versus max temperature</h2>
					</div>
					<p>Bar and line chart from the raw DuckDB table.</p>
				</div>
				<WeatherHistoryChart observations={observations} />
			</section>

			<section class="panel sidebar-panel">
				<div class="panel-heading">
					<div>
						<p class="panel-kicker">Snapshot</p>
						<h2>Current v0 shape</h2>
					</div>
				</div>

				<dl class="facts">
					<div>
						<dt>Hottest day</dt>
						<dd>{hottestDay?.weatherDate}</dd>
						<small>{hottestDay?.maxTemperatureC.toFixed(1)} C</small>
					</div>
					<div>
						<dt>Timezone</dt>
						<dd>{observations[0].timezone}</dd>
						<small>Stored with every observation</small>
					</div>
					<div>
						<dt>Database path</dt>
						<dd>../database/weather.duckdb</dd>
						<small>Shared by frontend, Python, and dbt</small>
					</div>
					<div>
						<dt>Last fetch</dt>
						<dd>{observations[observations.length - 1].fetchedAt}</dd>
						<small>Upserted by the scheduled pipeline</small>
					</div>
				</dl>
			</section>
		</div>

		<section class="panel table-panel">
			<div class="panel-heading">
				<div>
					<p class="panel-kicker">Raw table</p>
					<h2>`raw_weather` preview</h2>
				</div>
				<p>These rows are loaded server-side from DuckDB on each request.</p>
			</div>

			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Max temp</th>
							<th>Precipitation</th>
							<th>Source</th>
						</tr>
					</thead>
					<tbody>
						{#each observations as observation (observation.weatherDate)}
							<tr>
								<td>{observation.weatherDate}</td>
								<td>{observation.maxTemperatureC.toFixed(1)} C</td>
								<td>{observation.precipitationMm.toFixed(1)} mm</td>
								<td>{observation.source}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else}
		<section class="panel empty-state">
			<h2>No observations loaded yet.</h2>
			<p>Run `uv run python fetch.py` in `data-pipeline` to seed the DuckDB file.</p>
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

	.lede {
		max-width: 44rem;
		margin: 1rem 0 0;
		font-size: 1.05rem;
		line-height: 1.7;
		color: #425466;
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

	.metrics,
	.insight-grid {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.metrics {
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
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
		.facts dt,
		.facts small,
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

	.insight-grid {
		grid-template-columns: minmax(0, 2.1fr) minmax(18rem, 1fr);
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

	.facts {
		display: grid;
		gap: 0.9rem;
		margin: 0;
	}

	.facts div {
		padding: 1rem;
		border-radius: 1rem;
		background: rgba(245, 241, 232, 0.7);
	}

	.facts dt {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.facts dd {
		margin: 0.3rem 0 0;
		font-weight: 700;
		font-size: 1.05rem;
		color: #102033;
	}

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
		.insight-grid {
			grid-template-columns: 1fr;
		}

		.panel-heading {
			flex-direction: column;
			align-items: start;
		}
	}
</style>
