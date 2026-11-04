<script lang="ts">
	// Raster versions of owl.svg (2 MB of vector paths, previously used for
	// both the favicon and the nav image and the page's LCP element).
	import owl from '$lib/assets/owl.webp';
	import favicon from '$lib/assets/favicon.png';

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
	<link rel="icon" type="image/png" href={favicon} />
	<title>Sentience | {activePage?.title ?? ''}</title>
	<meta
		name="description"
		content="Sentience dashboard: message activity, a conversation explorer and per-user data collected from the Discord server."
	/>
</svelte:head>

<a class="skip-link" href="#main-content">Skip to main content</a>
<div class="page">
	<SideNav isOpen fixed ariaLabel="Main navigation">
		<SideNavItems>
			{#each navPages as page_obj (page_obj.href)}
				<SideNavLink
					text={page_obj.title}
					href={page_obj.href}
					isSelected={isActive(page_obj.href, page.url.pathname)}
				/>
			{/each}
		</SideNavItems>
		<img alt="Cool owl by Sylvan Franklin" src={owl} width="256" height="286" decoding="async" />
	</SideNav>
	<main class="content" id="main-content" tabindex="-1">
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
		width: 100%;
		height: auto;
	}

	/* Visible only when focused with the keyboard. */
	.skip-link {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 9000;
		padding: 0.75rem 1rem;
		background: var(--cds-interactive-01, #0f62fe);
		color: var(--cds-text-04, #ffffff);
		transform: translateY(-100%);
	}

	.skip-link:focus {
		transform: translateY(0);
	}

	main:focus {
		outline: none;
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
