import { defineConfig } from '@playwright/test';

import { TEST_DB_PATH } from './tests/e2e/global-setup.js';

export default defineConfig({
	globalSetup: './tests/e2e/global-setup.ts',
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173,
		env: { PORT: '4173' },
		reuseExistingServer: !process.env.CI
	},
	testDir: 'tests/e2e'
});
