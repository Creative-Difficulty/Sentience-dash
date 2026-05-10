<script lang="ts">
	import {
		Column,
		Grid,
		Row,
		Tile,
		Section,
		Tag,
		ListItem,
		UnorderedList,
		Heading
	} from 'carbon-components-svelte';

	import type { PageProps } from './$types';
	import { AreaChart, ChartTheme, DonutChart, ScaleTypes } from '@carbon/charts-svelte';
	import { ArrowDown, ArrowUp } from 'carbon-icons-svelte';

	let { data }: PageProps = $props();
</script>

<Section>
	<Grid class="grid" padding={true}>
		<Row>
			<Column lg={8} md={8} sm={4}>
				<Tile>
					<AreaChart
						data={data.twentyfourHourChart!}
						options={{
							theme: ChartTheme.G100,
							title: 'Messages recorded per hour in the last 24 hours',
							height: '200px',
							grid: {
								y: {
									enabled: false
								},
								x: {
									enabled: false
								}
							},
							// TODO fix
							// style: { prefix: 'border-style: none;' },
							axes: {
								left: {
									mapsTo: 'count',
									scaleType: ScaleTypes.LINEAR,
									title: 'Messages'
								},
								bottom: { mapsTo: 'hour', scaleType: ScaleTypes.LABELS, title: 'Hours ago' }
							},
							legend: { enabled: false },
							color: {
								gradient: {
									enabled: true
								}
							}
						}}
					/>
				</Tile>
			</Column>
			<Column lg={8} md={8} sm={4}>
				<Tile>
					<AreaChart
						data={data.allTimeChart!}
						options={{
							theme: ChartTheme.G100,
							title: 'Alltime Messages recorded',
							height: '200px',
							grid: {
								y: {
									enabled: false
								},
								x: {
									enabled: false
								}
							},
							// TODO fix
							// style: { prefix: 'border-style: none;' },
							axes: {
								left: {
									mapsTo: 'count',
									scaleType: ScaleTypes.LINEAR,
									title: 'Messages'
								},
								bottom: { mapsTo: 'day', scaleType: ScaleTypes.LABELS, title: 'Days ago' }
							},
							legend: { enabled: false },
							color: {
								gradient: {
									enabled: true
								}
							}
						}}
					/>
				</Tile>
			</Column>
			<Column lg={8} md={8} sm={4}>
				<Tile>
					<DonutChart
						data={data.channelTypeCounts!}
						options={{
							title: 'Channel types',
							resizable: true,
							legend: {
								position: 'left',
								truncation: {
									type: 'none'
								}
							},
							donut: {
								center: {
									label: 'Channels'
								}
							},
							height: '400px',
							theme: 'g100'
						}}
					/>
				</Tile>
			</Column>

			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">Top active users in the last 24h</p>
						<UnorderedList>
							{#each data.mostActiveUserTwoFourH as user, index (user)}
								<div style="line-height: 150%;">
									<ListItem>
										{#if index === 0}
											<Section level={3}>
												<Heading
													>{user.username}: {user.messageCount}

													{user.messageCount == 1 ? 'message' : 'messages'}</Heading
												>
											</Section>
										{:else}
											{user.username}: {user.messageCount}

											{user.messageCount == 1 ? 'message' : 'messages'}
										{/if}
									</ListItem>
								</div>
							{/each}
						</UnorderedList>
					</div>
				</Tile>
			</Column>
			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">Top active users alltime</p>
						<UnorderedList>
							{#each data.mostActiveUsersEver as user, index (user)}
								<div style="line-height: 150%;">
									<ListItem>
										{#if index === 0}
											<Section level={3}>
												<Heading
													>{user.username}: {user.messageCount}

													{user.messageCount == 1 ? 'message' : 'messages'}</Heading
												>
											</Section>
										{:else}
											{user.username}: {user.messageCount}

											{user.messageCount == 1 ? 'message' : 'messages'}
										{/if}
									</ListItem>
								</div>
							{/each}
						</UnorderedList>
					</div>
				</Tile>
			</Column>

			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">Total Messages</p>
						<p class="stat-value">{data.totalMessages}</p>
					</div>
				</Tile>
			</Column>
			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">Messages recorded in the last 24 hours</p>
						<p class="stat-value">{data.totalMessagesLasttwoFourH}</p>
						<Tag
							type={data.totalMessagesprevTwoFourH! > data.totalMessagesLasttwoFourH!
								? 'red'
								: 'green'}
						>
							<Row>
								{#if data.totalMessagesprevTwoFourH! > data.totalMessagesLasttwoFourH!}
									Down {data.totalMessagesprevTwoFourH! - data.totalMessagesLasttwoFourH!} messages from
									yesterday
									<ArrowDown />
								{:else}
									Up {data.totalMessagesprevTwoFourH! - data.totalMessagesLasttwoFourH!} messages from
									yesterday
									<ArrowUp />
								{/if}
							</Row>
						</Tag>
					</div>
				</Tile>
			</Column>
		</Row>
	</Grid>
</Section>

<style>
	.stat-tile {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--cds-text-secondary, #c6c6c6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 300;
		color: var(--cds-text-primary, #f4f4f4);
		line-height: 1;
		margin: 0;
	}
</style>
