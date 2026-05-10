<script lang="ts">
	import {
		DataTable,
		Pagination,
		Toolbar,
		ToolbarContent,
		ToolbarSearch,
		Tile,
		Tag,
		StructuredList,
		StructuredListHead,
		StructuredListRow,
		StructuredListCell,
		StructuredListBody,
		Heading,
		Section,
		Grid,
		Row,
		Column
	} from 'carbon-components-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const user = $derived(data.user);
	const accounts = $derived(data.accounts ?? []);
	const messages = $derived(data.messages ?? []);
	const facts = $derived(data.facts ?? []);
	const truncated = $derived(data.truncated ?? false);

	const primaryName = $derived(
		user?.nickname ?? accounts[0]?.displayName ?? accounts[0]?.username ?? 'Unknown user'
	);

	const headers: {
		key: 'messageId' | 'sentAt' | 'channelName' | 'content';
		value: string;
	}[] = [
		{ key: 'messageId', value: 'Message ID' },
		{ key: 'sentAt', value: 'Sent' },
		{ key: 'channelName', value: 'Channel' },
		{ key: 'content', value: 'Content' }
	];

	const rows = $derived(
		messages.map((m) => ({
			id: m.messageId,
			messageId: m.messageId,
			sentAt: m.sentAt,
			channelName: m.channelName,
			content: m.content
		}))
	);

	let pageSize = $state(25);
	let page = $state(1);

	const factHeaders: {
		key:
			| 'recordType'
			| 'type'
			| 'value'
			| 'confidence'
			| 'level'
			| 'source'
			| 'isCurrent'
			| 'createdAt';
		value: string;
	}[] = [
		{ key: 'recordType', value: 'Kind' },
		{ key: 'type', value: 'Type' },
		{ key: 'value', value: 'Value' },
		{ key: 'confidence', value: 'Confidence' },
		{ key: 'level', value: 'Level' },
		{ key: 'source', value: 'Source' },
		{ key: 'isCurrent', value: 'Current' },
		{ key: 'createdAt', value: 'Added' }
	];

	const factRows = $derived(
		facts.map((f) => ({
			id: f.id,
			recordType: f.recordType,
			type: f.type,
			value: f.value,
			confidence: f.confidence,
			level: f.level,
			source: f.source,
			isCurrent: f.isCurrent,
			createdAt: f.createdAt
		}))
	);

	let factPageSize = $state(25);
	let factPage = $state(1);

	function recordTypeColor(t: string) {
		switch (t) {
			case 'fact':
				return 'blue';
			case 'activity':
				return 'green';
			case 'skill':
				return 'purple';
			case 'emotion':
				return 'magenta';
			default:
				return 'gray';
		}
	}

	function formatDate(ts: string) {
		return new Date(ts).toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if user}
	<Section>
		<div class="header">
			<Heading>{primaryName}</Heading>
			{#if user.nickname}
				<Tag type="purple" size="sm">nickname</Tag>
			{/if}
		</div>

		<Grid padding>
			<Row>
				<Column lg={8} md={8} sm={4}>
					<Tile>
						<h4 class="card-title">Identity</h4>
						<StructuredList condensed flush>
							<StructuredListHead>
								<StructuredListRow head>
									<StructuredListCell head>Field</StructuredListCell>
									<StructuredListCell head>Value</StructuredListCell>
								</StructuredListRow>
							</StructuredListHead>
							<StructuredListBody>
								<StructuredListRow>
									<StructuredListCell noWrap>Vestibule ID</StructuredListCell>
									<StructuredListCell><code class="mono">{user.id}</code></StructuredListCell>
								</StructuredListRow>
								{#if user.nickname}
									<StructuredListRow>
										<StructuredListCell noWrap>Nickname</StructuredListCell>
										<StructuredListCell>{user.nickname}</StructuredListCell>
									</StructuredListRow>
								{/if}
								<StructuredListRow>
									<StructuredListCell noWrap>Linked accounts</StructuredListCell>
									<StructuredListCell>{accounts.length}</StructuredListCell>
								</StructuredListRow>
							</StructuredListBody>
						</StructuredList>
					</Tile>
				</Column>

				<Column lg={8} md={8} sm={4}>
					<Tile>
						<h4 class="card-title">Discord accounts</h4>
						{#if accounts.length === 0}
							<p class="empty">No Discord accounts linked.</p>
						{:else}
							<StructuredList condensed flush>
								<StructuredListHead>
									<StructuredListRow head>
										<StructuredListCell head>Display name</StructuredListCell>
										<StructuredListCell head>Username</StructuredListCell>
										<StructuredListCell head>Discord ID</StructuredListCell>
									</StructuredListRow>
								</StructuredListHead>
								<StructuredListBody>
									{#each accounts as a (a.discordUserId)}
										<StructuredListRow>
											<StructuredListCell>{a.displayName}</StructuredListCell>
											<StructuredListCell>@{a.username}</StructuredListCell>
											<StructuredListCell>
												<code class="mono">{a.discordUserId}</code>
											</StructuredListCell>
										</StructuredListRow>
									{/each}
								</StructuredListBody>
							</StructuredList>
						{/if}
					</Tile>
				</Column>
			</Row>

			<Row>
				<Column>
					<DataTable
						title="Messages"
						description={truncated
							? `Showing the most recent 1000 messages. ${rows.length} loaded.`
							: `${rows.length} ${rows.length === 1 ? 'message' : 'messages'} sent by this user.`}
						{headers}
						{rows}
						{pageSize}
						{page}
					>
						<Toolbar>
							<ToolbarContent>
								<ToolbarSearch persistent shouldFilterRows />
							</ToolbarContent>
						</Toolbar>
						<svelte:fragment slot="cell" let:cell>
							{#if cell.key === 'messageId'}
								<code class="mono">{cell.value}</code>
							{:else if cell.key === 'sentAt'}
								<span class="ts">{formatDate(cell.value)}</span>
							{:else if cell.key === 'channelName'}
								<span class="channel-pill">#{cell.value}</span>
							{:else}
								<span class="msg-cell">{cell.value}</span>
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
				</Column>
			</Row>

			<Row>
				<Column>
					<DataTable
						sortable
						title="Facts & Activities"
						description={`${factRows.length} ${factRows.length === 1 ? 'record' : 'records'} extracted for this user.`}
						headers={factHeaders}
						rows={factRows}
						pageSize={factPageSize}
						page={factPage}
					>
						<Toolbar>
							<ToolbarContent>
								<ToolbarSearch persistent shouldFilterRows />
							</ToolbarContent>
						</Toolbar>
						<svelte:fragment slot="cell" let:cell>
							{#if cell.key === 'recordType'}
								<Tag size="sm" type={recordTypeColor(cell.value)}>{cell.value}</Tag>
							{:else if cell.key === 'source'}
								<span class="source">{cell.value.replace('_', ' ')}</span>
							{:else if cell.key === 'confidence'}
								<span class="count">{(cell.value * 100).toFixed(0)}%</span>
							{:else if cell.key === 'level'}
								<span class="count">{cell.value ?? '—'}</span>
							{:else if cell.key === 'isCurrent'}
								<span class="bool">{cell.value ? 'yes' : 'no'}</span>
							{:else if cell.key === 'createdAt'}
								<span class="ts">{formatDate(cell.value)}</span>
							{:else if cell.key === 'value'}
								<span class="msg-cell">{cell.value}</span>
							{:else}
								{cell.value}
							{/if}
						</svelte:fragment>
					</DataTable>
					<Pagination
						bind:pageSize={factPageSize}
						bind:page={factPage}
						totalItems={factRows.length}
						pageSizeInputDisabled
						pageSizes={[10, 25, 50, 100]}
					/>
				</Column>
			</Row>
		</Grid>
	</Section>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}

	.card-title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--cds-text-secondary, #c6c6c6);
		margin: 0 0 0.75rem 0;
	}

	.mono {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: 0.75rem;
		color: var(--cds-text-primary, #f4f4f4);
		word-break: break-all;
	}

	.empty {
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.875rem;
		margin: 0;
	}

	.ts {
		font-variant-numeric: tabular-nums;
		color: var(--cds-text-secondary, #c6c6c6);
		white-space: nowrap;
	}

	.source {
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.bool {
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.count {
		font-variant-numeric: tabular-nums;
	}

	.channel-pill {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: var(--cds-layer-03, #525252);
		color: var(--cds-text-primary, #f4f4f4);
		border-radius: 12px;
		font-size: 0.75rem;
		line-height: 1rem;
		white-space: nowrap;
	}

	.msg-cell {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
		white-space: pre-wrap;
	}
</style>
