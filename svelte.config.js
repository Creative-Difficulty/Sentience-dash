import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { optimizeImports, optimizeCss } from 'carbon-preprocess-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	preprocess: [vitePreprocess(), optimizeImports(), optimizeCss()],
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),

		// Content-Security-Policy, sent as a header on every SSR response. 'auto'
		// adds a per-request nonce for SvelteKit's inline bootstrap script.
		// Other security headers are set in src/hooks.server.ts.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte/carbon set inline style attributes (e.g. chart sizing, topic colours)
				'style-src': ['self', 'unsafe-inline'],
				// custom emoji images come from Discord's CDN
				'img-src': ['self', 'data:', 'https://cdn.discordapp.com', 'https://media.discordapp.net'],
				// carbon-components-svelte's CSS loads IBM Plex from IBM's CDN
				'font-src': ['self', 'data:', 'https://1.www.s81c.com'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		},

		typescript: {
			config: (config) => ({
				...config,
				include: [...config.include, '../drizzle.config.ts']
			})
		}
	}
};

export default config;
