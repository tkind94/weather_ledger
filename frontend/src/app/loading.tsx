import type { ReactNode } from 'react';

import styles from './page.module.css';

export default function Loading(): ReactNode {
	return (
		<main className={styles.shell}>
			<section className={styles.hero}>
				<div>
					<p className={styles.kicker}>Loading cached weather history</p>
					<h1 className={styles.title}>Refreshing the dashboard…</h1>
					<p className={styles.subtitle}>
						Opening the SQLite cache and hydrating the latest weather history.
					</p>
				</div>
			</section>
		</main>
	);
}
