import type { ReactNode } from 'react';

import {
	formatDate,
	formatPrecipitation,
	formatTemperature,
	type WeatherObservation
} from '@/lib/weather';

import styles from './observation-table.module.css';

type Props = {
	observations: WeatherObservation[];
};

export function ObservationTable({ observations }: Props): ReactNode {
	const recent = [...observations].reverse().slice(0, 28);

	return (
		<section className={styles.card}>
			<header className={styles.header}>
				<div>
					<p className={styles.eyebrow}>Ledger</p>
					<h3 className={styles.title}>Latest cached observations</h3>
				</div>
				<p className={styles.copy}>
					Showing the most recent {recent.length} days stored in SQLite.
				</p>
			</header>

			<div className={styles.tableWrap}>
				<table className={styles.table}>
					<thead>
						<tr>
							<th scope="col">Date</th>
							<th scope="col">High</th>
							<th scope="col">Low</th>
							<th scope="col">Precipitation</th>
						</tr>
					</thead>
					<tbody>
						{recent.length === 0 ? (
							<tr>
								<td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
									No data available
								</td>
							</tr>
						) : (
							recent.map((observation) => (
								<tr key={observation.weatherDate}>
									<td>{formatDate(observation.weatherDate)}</td>
									<td>{formatTemperature(observation.maxTemperature)}</td>
									<td>{formatTemperature(observation.minTemperature)}</td>
									<td>{formatPrecipitation(observation.precipitation)}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}
