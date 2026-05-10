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
</script>

<svelte:head>
	<link rel="icon" href={owl} />
	<title
		>Sentience | {navPages.find(
			(e) => e.href == page.url.pathname.slice(page.url.pathname.lastIndexOf('/'))
		)?.title}</title
	>
</svelte:head>

<div class="layout">
	<SideNav isOpen fixed>
		<SideNavItems>
			{#each navPages as page_obj (page_obj.href)}
				<SideNavLink
					text={page_obj.title}
					href={page_obj.href}
					isSelected={page_obj.href == page.url.pathname.slice(page.url.pathname.lastIndexOf('/'))}
				/>
			{/each}
		</SideNavItems>
		<img alt="Cool owl by Sylvan Franklin" src={owl} />
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
	{#if page.data.error}
		<div>
			<ToastNotification lowContrast title="Error" subtitle={page.data.error} />
		</div>
	{/if}
	<footer>Favicon and owl drawing by Sylvan Franklin<br />Website by Creative-Difficulty</footer>
</div>

<style>
	img {
		height: 20%;
		bottom: 5%;
		left: 2%;
		position: relative;
	}

	footer {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		text-align: center;
		padding-bottom: 1%;
		line-height: 150%;
	}
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
