<script lang="ts">
	import owl from '$lib/assets/owl.svg';

	import 'carbon-components-svelte/css/g100.css';
	import '@carbon/charts-svelte/styles.css';

	import {
		Header,
		SideNav,
		SideNavItems,
		SideNavLink,
		Heading,
		ToastNotification
	} from 'carbon-components-svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';

	let { children } = $props();

	// Carbon's "large" breakpoint (66rem). At and above it the side nav is a
	// permanent column; below it the nav collapses behind the header's
	// hamburger button and opens as an overlay.
	const NAV_BREAKPOINT = 1056;

	// Bound to both Header (which opens it by default above the breakpoint and
	// renders the hamburger toggle below it) and SideNav.
	let isSideNavOpen = $state(false);

	afterNavigate(() => {
		// Close the overlay nav after following a link on small screens.
		if (window.innerWidth < NAV_BREAKPOINT) isSideNavOpen = false;
	});

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
	<div class="mobile-header">
		<Header
			companyName="Sentience"
			platformName={activePage?.title ?? ''}
			href="/"
			expansionBreakpoint={NAV_BREAKPOINT}
			bind:isSideNavOpen
		/>
	</div>
	<SideNav bind:isOpen={isSideNavOpen} expansionBreakpoint={NAV_BREAKPOINT}>
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
		<div class="toast-region">
			<ToastNotification title="Error" subtitle={page.data.error} />
		</div>
	{/if}
	<footer>Favicon and owl drawing by Sylvan Franklin<br />Website by Creative-Difficulty</footer>
</div>

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
	}

	/* Wide data tables scroll inside their container instead of widening the page. */
	:global(.bx--data-table-container) {
		overflow-x: auto;
	}

	img {
		padding-bottom: 20%;
		max-width: 100%;
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

	/* Small screens: full-width content below the fixed 3rem Carbon header. */
	.content {
		/* Flex/grid children default to min-width: auto, which lets wide
		   content (tables, long strings) push the page wider than the viewport. */
		min-width: 0;
		margin-top: 3rem;
		padding: 1rem;
		flex: 1;
	}

	@media (min-width: 42rem) {
		.content {
			padding: 2rem;
		}
	}

	/* Large screens: permanent 16rem side nav column, no header bar (as before). */
	@media (min-width: 66rem) {
		.mobile-header {
			display: none;
		}

		.content {
			margin-top: 0;
			margin-left: 16rem;
		}

		footer {
			margin-left: 16rem;
		}
	}

	.page-header {
		padding-bottom: 2.5rem;
	}

	.subtitle {
		margin-top: 0.5rem;
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.875rem;
	}

	/* Errors used to render in normal flow at the far left, underneath the
	   side nav (z-index 8000), so only a 32px sliver was visible. Float the
	   toast above the shell instead. */
	.toast-region {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 9000;
		max-width: calc(100vw - 2rem);
	}

	.toast-region :global(.bx--toast-notification) {
		max-width: 100%;
		margin: 0;
	}

	.toast-region :global(.bx--toast-notification__subtitle) {
		max-height: 40vh;
		overflow-y: auto;
		overflow-wrap: anywhere;
	}
</style>
