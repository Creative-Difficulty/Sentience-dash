<script lang="ts">
	import {
		DataTable,
		Pagination,
		Toolbar,
		ToolbarContent,
		ToolbarSearch,
		Section
	} from 'carbon-components-svelte';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();

	const users = $derived(data.users ?? []);

	const headers: {
		key: 'displayName' | 'username' | 'discordUserId' | 'messageCount';
		value: string;
	}[] = [
		{ key: 'displayName', value: 'Display Name' },
		{ key: 'username', value: 'Username' },
		{ key: 'discordUserId', value: 'Discord User ID' },
		{ key: 'messageCount', value: 'Messages' }
	];

	const rows = $derived(
		users.map((u) => ({
			id: u.discordUserId,
			vestibuleUserId: u.vestibuleUserId,
			displayName: u.displayName,
			username: u.username,
			discordUserId: u.discordUserId,
			messageCount: u.messageCount
		}))
	);

	let pageSize = $state(25);
	let page = $state(1);
</script>

<Section>
	<p class="subtitle">{users.length} {users.length === 1 ? 'account' : 'accounts'} tracked</p>

	<DataTable
		sortable
		{headers}
		{rows}
		{pageSize}
		{page}
		sortKey="messageCount"
		sortDirection="descending"
	>
		<Toolbar>
			<ToolbarContent>
				<ToolbarSearch persistent shouldFilterRows />
			</ToolbarContent>
		</Toolbar>
		<svelte:fragment slot="cell" let:cell let:row>
			{#if cell.key === 'displayName'}
				<a class="user-link" href={resolve(`/userdata/${row.vestibuleUserId}`)}>{cell.value}</a>
			{:else if cell.key === 'username'}
				<span class="username">@{cell.value}</span>
			{:else if cell.key === 'discordUserId'}
				<code class="mono">{cell.value}</code>
			{:else if cell.key === 'messageCount'}
				<span class="count">{cell.value.toLocaleString()}</span>
			{:else}
				{cell.value}
			{/if}
		</svelte:fragment>
	</DataTable>

	<Pagination
		bind:pageSize
		bind:page
		totalItems={rows.length}
		pageSizeInputDisabled
		pageSizes={[10, 25, 50, 100]}
	/>
</Section>

<style>
	.subtitle {
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
	}

	.user-link {
		color: var(--cds-link-01, #78a9ff);
		text-decoration: none;
		font-weight: 500;
	}

	.user-link:hover {
		text-decoration: underline;
	}

	.username {
		color: var(--cds-text-secondary, #c6c6c6);
	}

	.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.75rem;
		color: var(--cds-text-secondary, #c6c6c6);
	}

	.count {
		font-variant-numeric: tabular-nums;
		font-weight: 500;
	}
</style>
