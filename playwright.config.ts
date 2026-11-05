import { defineConfig, devices } from '@playwright/test';

// End-to-end smoke tests against a production build (`node build`).
//
//   E2E_DATABASE_URL  database with unidb-schema/schema/*.sql + a seed loaded
//                     (the tests read it too, to compute expected values)
//   E2E_PORT          port for the app (default 4173)
//   E2E_BASE_URL      test an already running server instead of starting one
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: [['list']],
	use: { baseURL, trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command: 'bun run build && node build',
				url: `${baseURL}/robots.txt`,
				timeout: 180_000,
				reuseExistingServer: false,
				env: {
					DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
					PORT: String(port),
					HOST: '127.0.0.1'
				}
			}
});
