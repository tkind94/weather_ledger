<script lang="ts">
	import { onMount } from 'svelte';
	import * as echarts from 'echarts';

	import type { WeatherObservation } from '$lib/weather';
	import type { UnitSystem } from '$lib/stores/units';

	let { observations, unitSystem = 'metric' }: { observations: WeatherObservation[]; unitSystem?: UnitSystem } = $props();
	let chartElement: HTMLDivElement;
	let chart: echarts.ECharts | undefined = $state();

	const cToF = (c: number) => c * 9 / 5 + 32;
	const mmToIn = (mm: number) => mm / 25.4;

	function buildOptions(): echarts.EChartsOption {
		const isImperial = unitSystem === 'imperial';
		const precipLabel = isImperial ? 'Precipitation (in)' : 'Precipitation (mm)';
		const tempLabel = isImperial ? 'Max temp (°F)' : 'Max temp (°C)';

		return {
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
				data: observations.map((o) => o.weatherDate)
			},
			yAxis: [
				{
					type: 'value',
					name: precipLabel,
					axisLabel: { color: '#425466' },
					splitLine: { lineStyle: { color: 'rgba(15, 23, 32, 0.08)' } }
				},
				{
					type: 'value',
					name: tempLabel,
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
					data: observations.map((o) => isImperial ? mmToIn(o.precipitation) : o.precipitation)
				},
				{
					name: 'Max temperature',
					type: 'line',
					yAxisIndex: 1,
					smooth: true,
					symbolSize: 10,
					lineStyle: { width: 3, color: '#d96c06' },
					itemStyle: { color: '#d96c06' },
					data: observations.map((o) => isImperial ? cToF(o.maxTemperature) : o.maxTemperature)
				}
			]
		};
	}

	onMount(() => {
		chart = echarts.init(chartElement);
		chart.setOption(buildOptions());

		const resizeChart = () => chart?.resize();
		window.addEventListener('resize', resizeChart);

		return () => {
			window.removeEventListener('resize', resizeChart);
			chart?.dispose();
			chart = undefined;
		};
	});

	$effect(() => {
		if (chart) {
			chart.setOption(buildOptions());
		}
	});
</script>

<div bind:this={chartElement} class="chart"></div>

<style>
	.chart {
		height: 21rem;
		width: 100%;
	}
</style>