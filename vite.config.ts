import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { optimizeCss } from 'carbon-preprocess-svelte';

export default defineConfig({
    // optimizeCss is a Vite plugin (it was listed as a Svelte preprocessor,
    // where it did nothing): it prunes unused Carbon CSS from the production
    // build. Keep every IBM Plex @font-face: the pages use weight 500, which
    // the default pruning drops. Faces are only downloaded when used.
    plugins: [sveltekit(), optimizeCss({ preserveAllIBMFonts: true })],
    ssr: {
        noExternal: process.env.NODE_ENV === 'production' ? ['@carbon/charts'] : []
    }
});
