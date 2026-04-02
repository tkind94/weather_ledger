import { defineConfig } from '@playwright/test';

import { TEST_DB_PATH, TEST_MAP_LOCATION_KEY } from './tests/e2e/test-db.js';

export default defineConfig({
	webServer: {
		command:
			'cd ../data-pipeline && uv run python ../frontend/tests/e2e/prepare_preview_db.py && cd ../frontend && bun run build && bun run preview',
		port: 4173,
		env: {
			PORT: '4173',
			WEATHER_LEDGER_DB_PATH: TEST_DB_PATH,
			WEATHER_LEDGER_TEST_MAP_LOCATION_KEY: TEST_MAP_LOCATION_KEY
		},
		reuseExistingServer: !process.env.CI
	},
	testDir: 'tests/e2e'
});
