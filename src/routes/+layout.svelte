<script lang="ts">
	import owl from '$lib/assets/owl.svg';

	import 'carbon-components-svelte/css/g100.css';
	import '@carbon/charts-svelte/styles.css';

	import {
		SideNav,
		SideNavItems,
		SideNavLink,
		Heading,
		ToastNotification
	} from 'carbon-components-svelte';
	import { page } from '$app/state';

	let { children } = $props();

	let navPages = [
		{ title: 'Overview', href: '/' },
		{ title: 'Conversation Explorer', href: '/explorer' },
		{ title: 'User data', href: '/userdata' }
	];

	function isActive(href: string, pathname: string) {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}

	const activePage = $derived(navPages.find((p) => isActive(p.href, page.url.pathname)));
</script>

<svelte:head>
	<link rel="icon" href={owl} />
	<title>Sentience | {activePage?.title ?? ''}</title>
</svelte:head>

<div class="page">
	<SideNav isOpen fixed>
		<SideNavItems>
			{#each navPages as page_obj (page_obj.href)}
				<SideNavLink
					text={page_obj.title}
					href={page_obj.href}
					isSelected={isActive(page_obj.href, page.url.pathname)}
				/>
			{/each}
		</SideNavItems>
		<img alt="Cool owl by Sylvan Franklin" src={owl} />
	</SideNav>
	<main class="content">
		<div class="page-header">
			<Heading>Sentience</Heading>
			<p class="subtitle">
				{activePage?.title ?? ''}
			</p>
		</div>
		{@render children()}
	</main>
	{#if page.data.error}
		<div>
			<ToastNotification style="z-index: 999;" title="Error" subtitle={page.data.error} />
		</div>
	{/if}
	<footer>Favicon and owl drawing by Sylvan Franklin<br />Website by Creative-Difficulty</footer>
</div>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
	}

	img {
		padding-bottom: 20%;
	}

	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
	}

	footer {
		text-align: center;
		padding: 20px;
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
