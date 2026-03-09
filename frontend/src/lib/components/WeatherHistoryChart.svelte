<script lang="ts">
	import { onMount } from 'svelte';
	import * as echarts from 'echarts';

	import type { WeatherObservation } from '$lib/weather';

	let { observations }: { observations: WeatherObservation[] } = $props();
	let chartElement: HTMLDivElement;

	onMount(() => {
		const chart = echarts.init(chartElement);
		chart.setOption({
			animationDuration: 700,
			animationEasing: 'cubicOut',
			grid: { left: 36, right: 36, top: 24, bottom: 36 },
			tooltip: { trigger: 'axis' },
			legend: {
				bottom: 0,
				textStyle: { color: '#213547', fontFamily: 'Avenir Next, Segoe UI, sans-serif' }
			},
			xAxis: {
				type: 'category',
				axisLabel: { color: '#425466' },
				axisLine: { lineStyle: { color: 'rgba(15, 23, 32, 0.2)' } },
				data: observations.map((observation) => observation.weatherDate)
			},
			yAxis: [
				{
					type: 'value',
					name: 'Precipitation (mm)',
					axisLabel: { color: '#425466' },
					splitLine: { lineStyle: { color: 'rgba(15, 23, 32, 0.08)' } }
				},
				{
					type: 'value',
					name: 'Max temp (C)',
					axisLabel: { color: '#425466' },
					splitLine: { show: false }
				}
			],
			series: [
				{
					name: 'Precipitation',
					type: 'bar',
					barMaxWidth: 28,
					itemStyle: { color: '#0b7285', borderRadius: [10, 10, 0, 0] },
					data: observations.map((observation) => observation.precipitationMm)
				},
				{
					name: 'Max temperature',
					type: 'line',
					yAxisIndex: 1,
					smooth: true,
					symbolSize: 10,
					lineStyle: { width: 3, color: '#d96c06' },
					itemStyle: { color: '#d96c06' },
					data: observations.map((observation) => observation.maxTemperatureC)
				}
			]
		});

		const resizeChart = () => chart.resize();
		window.addEventListener('resize', resizeChart);

		return () => {
			window.removeEventListener('resize', resizeChart);
			chart.dispose();
		};
	});
</script>

<div bind:this={chartElement} class="chart"></div>

<style>
	.chart {
		height: 21rem;
		width: 100%;
	}
</style>