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
		0.1,
		...recentObservations.map((observation) => observation.precipitation)
	);
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

	return (
		<section className={styles.card}>
			<header className={styles.header}>
				<div>
					<p className={styles.eyebrow}>Trend</p>
					<h3 className={styles.title}>Recent temperature and precipitation</h3>
				</div>
				<div className={styles.legend}>
					<span className={styles.legendItem}>
						<span className={styles.legendLine} /> Max temperature
					</span>
					<span className={styles.legendItem}>
						<span className={styles.legendBar} /> Precipitation
					</span>
				</div>
			</header>

			<div className={styles.chartShell}>
				<svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img">
					<title>Weather history chart for the latest sixty cached days</title>
					{recentObservations.map((observation, index) => {
						const x = padding.left + index * step;
						const barHeight = (observation.precipitation / maxPrecipitation) * innerHeight;
						const barWidth = Math.max(4, step * 0.42);
						return (
							<rect
								fill="rgba(31, 143, 131, 0.24)"
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
						stroke="#f5853f"
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
					Peak {formatTemperature(maxTemperature)} · Wettest day{' '}
					{formatPrecipitation(maxPrecipitation)}
				</p>
			</footer>
		</section>
	);
}
