<script lang="ts">
	import { Column, Grid, Row, Tile, Section, Tag } from 'carbon-components-svelte';

	import type { PageProps } from './$types';
	import { AreaChart, ScaleTypes } from '@carbon/charts-svelte';

	let { data }: PageProps = $props();
</script>

<Section>
	<Grid class="grid" padding={true}>
		<Row>
			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">Lorem ipsum</p>
						<p class="stat-value">no</p>
						<Tag type="green">yeah</Tag>
					</div>
				</Tile>
			</Column>
			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">Sit amet dolor</p>
						<p class="stat-value">filler content</p>
						<Tag type="blue">here</Tag>
					</div>
				</Tile>
			</Column>
			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">yes here too</p>
						<p class="stat-value">i dont have this content yet</p>
						<Tag type="green">here neither</Tag>
					</div>
				</Tile>
			</Column>
			<Column lg={4} md={4} sm={4}>
				<Tile>
					<div class="stat-tile">
						<p class="stat-label">nope</p>
						<p class="stat-value">still no</p>
						<Tag type="purple">hellnaw</Tag>
					</div>
				</Tile>
			</Column>
		</Row>
		<Row>
			<Column lg={8} md={8} sm={4}>
				<Tile>
					<AreaChart
						data={data.data!}
						options={{
							theme: 'g90',
							title: 'Messages sent per hour in the last 24 hours',
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
								left: { mapsTo: 'count', scaleType: ScaleTypes.LINEAR, title: 'Messages sent' },
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
					<div class="chart-placeholder">Chart placeholder</div>
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

	.chart-placeholder {
		min-height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--cds-text-secondary, #c6c6c6);
		font-style: italic;
	}
</style>
