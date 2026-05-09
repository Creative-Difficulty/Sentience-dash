<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	import 'carbon-components-svelte/css/g100.css';
	import '@carbon/charts-svelte/styles.css';

	import { SideNav, SideNavItems, SideNavLink, Heading } from 'carbon-components-svelte';
	import { page } from '$app/state';

	let { children } = $props();

	let navPages = [
		{ title: 'Overview', href: '/' },
		{ title: 'Conversation Explorer', href: '/explorer' },
		{ title: 'User data', href: '/userdata' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout">
	<SideNav isOpen fixed>
		<SideNavItems>
			{#each navPages as page (page)}
				<SideNavLink text={page.title} href={page.href} isSelected={page.href == '/'} />
			{/each}
		</SideNavItems>
	</SideNav>
	<main class="content">
		<div class="page-header">
			<Heading>Sentience</Heading>
			<p class="subtitle">
				{navPages.find((e) => e.href == page.url.pathname.slice(page.url.pathname.lastIndexOf('/')))
					?.title}
			</p>
		</div>
		{@render children()}
	</main>
</div>

<style>
	.layout {
		display: flex;
		min-height: 100vh;
	}

	.content {
		margin-left: 256px;
		padding: 2rem;
		flex: 1;
	}

	.page-header {
		padding-bottom: 2.5rem;
	}

	.subtitle {
		margin-top: 0.5rem;
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.875rem;
	}

	@media (max-width: 672px) {
		.content {
			margin-left: 0;
			padding: 1rem;
		}
	}
</style>
