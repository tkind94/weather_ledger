import type { ReactNode } from 'react';

import { LocationSearchPanel } from '@/components/location-search-panel';
import { ObservationTable } from '@/components/observation-table';
import { WeatherChart } from '@/components/weather-chart';
import {
	coordinateLabel,
	formatDate,
	formatDateRange,
	formatPrecipitation,
	formatTemperature,
	formatTimestamp
} from '@/lib/weather';
import { loadDashboard } from '@/lib/server/weather';

import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type HomePageProps = {
	searchParams?: Promise<{
		location?: string | string[];
	}>;
};

function singleValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps): Promise<ReactNode> {
	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const data = await loadDashboard(singleValue(resolvedSearchParams?.location));
	const { cachedLocations, selectedLocation, observations, summary } = data;

	return (
		<main className={styles.shell}>
			<section className={styles.hero}>
				<div>
					<p className={styles.kicker}>Open-Meteo + local SQLite cache</p>
					<h1 className={styles.title}>Weather Ledger</h1>
					<p className={styles.subtitle}>
						React and Next.js on the surface, one SQLite file underneath, and no background pipeline
						to babysit. Search a place, cache it, and inspect daily history instantly.
					</p>
				</div>
				<div className={styles.heroCard}>
					<p className={styles.heroCardLabel}>Cached locations</p>
					<p className={styles.heroCardValue}>{cachedLocations.length}</p>
					<p className={styles.heroCardMeta}>
						{selectedLocation
							? `Current range: ${formatDateRange(
									selectedLocation.firstObservationDate,
									selectedLocation.latestObservationDate
								)}`
							: 'The first request seeds the default location automatically.'}
					</p>
				</div>
			</section>

			<div className={styles.layout}>
				<aside className={styles.sidebar}>
					<LocationSearchPanel
						cachedLocations={cachedLocations}
						selectedLocation={selectedLocation}
					/>
				</aside>

				<section className={styles.content}>
					{selectedLocation ? (
						<>
							<header className={styles.locationHeader}>
								<div>
									<p className={styles.locationEyebrow}>Current dataset</p>
									<h2 className={styles.locationTitle}>{selectedLocation.displayName}</h2>
									<p className={styles.locationMeta}>
										<span>
											{coordinateLabel(selectedLocation.latitude, selectedLocation.longitude)}
										</span>
										<span>{selectedLocation.timezone}</span>
										<span>Updated {formatTimestamp(selectedLocation.lastFetchedAt)}</span>
									</p>
								</div>
								<p className={styles.locationRange}>
									{formatDateRange(
										selectedLocation.firstObservationDate,
										selectedLocation.latestObservationDate
									)}
								</p>
							</header>

							<div className={styles.summaryGrid}>
								<article className={styles.summaryCard}>
									<p className={styles.summaryLabel}>Observation days</p>
									<p className={styles.summaryValue}>{summary?.observationCount ?? 0}</p>
									<p className={styles.summaryMeta}>
										First day {formatDate(selectedLocation.firstObservationDate)}
									</p>
								</article>
								<article className={styles.summaryCard}>
									<p className={styles.summaryLabel}>Average high</p>
									<p className={styles.summaryValue}>
										{formatTemperature(summary?.avgHigh ?? null)}
									</p>
									<p className={styles.summaryMeta}>
										Average low {formatTemperature(summary?.avgLow ?? null)}
									</p>
								</article>
								<article className={styles.summaryCard}>
									<p className={styles.summaryLabel}>Total precipitation</p>
									<p className={styles.summaryValue}>
										{formatPrecipitation(summary?.totalPrecipitation ?? null)}
									</p>
									<p className={styles.summaryMeta}>Across the entire cached history</p>
								</article>
								<article className={styles.summaryCard}>
									<p className={styles.summaryLabel}>Hottest day</p>
									<p className={styles.summaryValue}>
										{formatTemperature(summary?.hottestTemperature ?? null)}
									</p>
									<p className={styles.summaryMeta}>{formatDate(summary?.hottestDate ?? null)}</p>
								</article>
								<article className={styles.summaryCard}>
									<p className={styles.summaryLabel}>Wettest day</p>
									<p className={styles.summaryValue}>
										{formatPrecipitation(summary?.wettestPrecipitation ?? null)}
									</p>
									<p className={styles.summaryMeta}>{formatDate(summary?.wettestDate ?? null)}</p>
								</article>
							</div>

							<WeatherChart observations={observations} />
							<ObservationTable observations={observations} />
						</>
					) : (
						<section className={styles.emptyState}>
							<p className={styles.locationEyebrow}>No cached history</p>
							<h2 className={styles.locationTitle}>
								Search a location to start building the ledger.
							</h2>
						</section>
					)}
				</section>
			</div>
		</main>
	);
}
