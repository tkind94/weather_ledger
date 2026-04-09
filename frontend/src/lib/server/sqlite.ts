import 'server-only';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import Database from 'better-sqlite3';

import { resolveSQLitePath } from '@/lib/server/config';

function createDatabase(): Database.Database {
	const databasePath = resolveSQLitePath();
	mkdirSync(dirname(databasePath), { recursive: true });

	const connection = new Database(databasePath);
	connection.pragma('journal_mode = WAL');
	connection.pragma('foreign_keys = ON');
	connection.exec(`
		CREATE TABLE IF NOT EXISTS locations (
			location_key TEXT PRIMARY KEY,
			display_name TEXT NOT NULL,
			name TEXT NOT NULL,
			admin1 TEXT,
			country TEXT,
			latitude REAL NOT NULL,
			longitude REAL NOT NULL,
			timezone TEXT NOT NULL,
			last_fetched_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS daily_weather (
			location_key TEXT NOT NULL,
			observation_date TEXT NOT NULL,
			max_temperature_c REAL NOT NULL,
			min_temperature_c REAL NOT NULL,
			precipitation_mm REAL NOT NULL,
			PRIMARY KEY (location_key, observation_date),
			FOREIGN KEY (location_key) REFERENCES locations(location_key) ON DELETE CASCADE
		);

		CREATE INDEX IF NOT EXISTS daily_weather_location_date_idx
		ON daily_weather (location_key, observation_date DESC);
	`);

	return connection;
}

const readDatabase = (() => {
	let connection: Database.Database | null = null;

	return (): Database.Database => {
		if (connection === null) {
			connection = createDatabase();
		}

		return connection;
	};
})();

export function getDatabase(): Database.Database {
	return readDatabase();
}
