import type { ReactNode } from 'react';

import {
	formatDate,
	formatPrecipitation,
	formatTemperature,
	type WeatherObservation
} from '@/lib/weather';

import styles from './weather-chart.module.css';

type Props = {
	observations: WeatherObservation[];
};

export function WeatherChart({ observations }: Props): ReactNode {
	if (observations.length < 2) {
		return (
			<section className={styles.card}>
				<header className={styles.header}>
					<div>
						<p className={styles.eyebrow}>Trend</p>
						<h3 className={styles.title}>Need more history</h3>
					</div>
				</header>
				<p className={styles.empty}>Cache at least two daily observations to draw the chart.</p>
			</section>
		);
	}

	const recentObservations = observations.slice(-60);
	const width = 760;
	const height = 280;
	const padding = { top: 18, right: 18, bottom: 30, left: 22 };
	const innerWidth = width - padding.left - padding.right;
	const innerHeight = height - padding.top - padding.bottom;
	const maxTemperature = Math.max(
		...recentObservations.map((observation) => observation.maxTemperature)
	);
	const minTemperature = Math.min(
		...recentObservations.map((observation) => observation.minTemperature)
	);
	const maxPrecipitation = Math.max(
		...recentObservations.map((observation) => observation.precipitation)
	);
	const maxPrecipitationWithFloor = Math.max(0.1, maxPrecipitation);
	const temperatureRange = Math.max(1, maxTemperature - minTemperature);
	const step = innerWidth / Math.max(1, recentObservations.length - 1);

	const linePoints = recentObservations
		.map((observation, index) => {
			const x = padding.left + index * step;
			const normalized = (observation.maxTemperature - minTemperature) / temperatureRange;
			const y = padding.top + innerHeight - normalized * innerHeight;
			return `${x},${y}`;
		})
		.join(' ');

	const minLinePoints = recentObservations
		.map((observation, index) => {
			const x = padding.left + index * step;
			const normalized = (observation.minTemperature - minTemperature) / temperatureRange;
			const y = padding.top + innerHeight - normalized * innerHeight;
			return `${x},${y}`;
		})
		.join(' ');

	return (
		<section className={styles.card}>
			<header className={styles.header}>
				<div>
					<p className={styles.eyebrow}>Trend</p>
					<h3 className={styles.title}>Recent temperature and precipitation</h3>
				</div>
				<div className={styles.legend}>
					<span className={styles.legendItem}>
						<span className={styles.legendLine} /> High
					</span>
					<span className={styles.legendItem}>
						<span className={styles.legendLineLow} /> Low
					</span>
					<span className={styles.legendItem}>
						<span className={styles.legendBar} /> Precipitation
					</span>
				</div>
			</header>

			<div className={styles.chartShell}>
				<svg
					className={styles.chart}
					viewBox={`0 0 ${width} ${height}`}
					role="img"
					aria-label="Weather history chart for the latest sixty cached days"
				>
					<title>Weather history chart for the latest sixty cached days</title>
					{recentObservations.map((observation, index) => {
						const x = padding.left + index * step;
						const barHeight = (observation.precipitation / maxPrecipitationWithFloor) * innerHeight;
						const barWidth = Math.max(4, step * 0.42);
						return (
							<rect
								fill="var(--accent)"
								fillOpacity="0.24"
								height={barHeight}
								key={observation.weatherDate}
								rx={4}
								width={barWidth}
								x={x - barWidth / 2}
								y={padding.top + innerHeight - barHeight}
							/>
						);
					})}
					<polyline
						fill="none"
						points={linePoints}
						stroke="var(--accent-warm)"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="4"
					/>
					<polyline
						fill="none"
						points={minLinePoints}
						stroke="#3f9af5"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="4"
					/>
				</svg>
			</div>

			<footer className={styles.footer}>
				<p>
					From {formatDate(recentObservations[0]?.weatherDate ?? null)} to{' '}
					{formatDate(recentObservations.at(-1)?.weatherDate ?? null)}
				</p>
				<p>
					Peak {formatTemperature(maxTemperature)} ·{' '}
					{maxPrecipitation === 0
						? 'No precipitation'
						: `Wettest day ${formatPrecipitation(maxPrecipitation)}`}
				</p>
			</footer>
		</section>
	);
}
