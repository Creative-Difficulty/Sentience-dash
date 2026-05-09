<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	import 'carbon-components-svelte/css/g100.css';

	let theme = 'g100'; // "white" | "g10" | "g80" | "g90" | "g100"

	document.documentElement.setAttribute('theme', theme);

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
