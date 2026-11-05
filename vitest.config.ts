import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Standalone vitest config (does not load the SvelteKit plugin): the code under
// test is plain TypeScript, so tests stay fast and need no $env / database.
export default defineConfig({
	resolve: {
		alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/**/*.test.ts'],
					environment: 'node',
					// property tests scale with FC_NUM_RUNS
					testTimeout: 120_000
				}
			},
			{
				extends: true,
				resolve: {
					alias: {
						'$env/dynamic/private': fileURLToPath(
							new URL('./tests/integration/env-shim.ts', import.meta.url)
						)
					}
				},
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.test.ts'],
					environment: 'node',
					testTimeout: 30_000,
					hookTimeout: 30_000
				}
			},
			{
				extends: true,
				test: {
					name: 'contract',
					include: ['tests/contract/**/*.test.ts'],
					environment: 'node',
					testTimeout: 30_000
				}
			}
		]
	}
});
