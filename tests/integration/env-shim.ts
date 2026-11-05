// Stand-in for SvelteKit's `$env/dynamic/private` when server modules are
// imported directly by vitest.
export const env: Record<string, string | undefined> = process.env;
