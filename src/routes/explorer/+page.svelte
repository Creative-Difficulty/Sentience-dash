<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { ComboBox, InlineLoading, Tag } from 'carbon-components-svelte';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();

	type Attachment = { contentType: string; objectKey: string; sizeBytes: number | null };
	type Reactor = { username: string; vestibuleUserId: string };
	type Reaction = {
		discordEmojiId: string | null;
		displayName: string | null;
		url: string | null;
		count: number;
		reactors: Reactor[];
	};
	type ReplyPreview = {
		messageId: string;
		username: string;
		displayName: string;
		vestibuleUserId: string;
		content: string;
	};
	type Topic = { topicId: string; topicName: string };
	type Message = {
		messageId: string;
		content: string;
		sentAt: string;
		inReplyTo: string | null;
		username: string;
		displayName: string;
		vestibuleUserId: string;
		reply: ReplyPreview | null;
		attachments: Attachment[];
		reactions: Reaction[];
		topic: Topic | null;
	};

	const channelItems = $derived(
		(data.channels ?? []).map((c) => ({ id: c.channelId, text: c.name }))
	);

	let selectedChannelId = $state<string | null>(null);
	let msgs = $state<Message[]>([]);
	let loading = $state(false);
	let hasMore = $state(false);
	let nextCursor = $state<string | null>(null);

	let chatEl: HTMLDivElement;
	let sentinelEl: HTMLDivElement;

	async function selectChannel(channelId: string) {
		loading = true;
		selectedChannelId = channelId;
		msgs = [];
		nextCursor = null;
		hasMore = false;

		try {
			const res = await fetch(`/api/messages?channelId=${channelId}`);
			const body = await res.json();
			msgs = (body.messages as Message[]).slice().reverse();
			hasMore = body.hasMore;
			nextCursor = body.nextCursor;
		} finally {
			loading = false;
		}

		await tick();
		chatEl.scrollTop = chatEl.scrollHeight;
	}

	async function loadMore() {
		if (loading || !hasMore || !selectedChannelId || nextCursor === null) return;
		loading = true;

		const prevHeight = chatEl.scrollHeight;
		const prevTop = chatEl.scrollTop;

		try {
			const res = await fetch(`/api/messages?channelId=${selectedChannelId}&before=${nextCursor}`);
			const body = await res.json();
			msgs = [...(body.messages as Message[]).slice().reverse(), ...msgs];
			hasMore = body.hasMore;
			nextCursor = body.nextCursor;
		} finally {
			loading = false;
		}

		await tick();
		chatEl.scrollTop = chatEl.scrollHeight - prevHeight + prevTop;
	}

	onMount(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) loadMore();
			},
			{ threshold: 0.1, root: chatEl }
		);
		observer.observe(sentinelEl);
		return () => observer.disconnect();
	});

	function formatDate(ts: string) {
		return new Date(ts).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function fileName(key: string) {
		return key.split('/').pop() ?? key;
	}

	function emojiLabel(r: Reaction) {
		if (r.displayName) return `:${r.displayName}:`;
		if (r.discordEmojiId) return r.discordEmojiId;
		return '?';
	}

	function scrollToMessage(messageId: string) {
		const el = chatEl.querySelector(`[data-mid="${messageId}"]`) as HTMLElement | null;
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		el.classList.add('highlighted');
		setTimeout(() => el.classList.remove('highlighted'), 1500);
	}

	function topicHue(topicId: string) {
		// Two pass mixing hash so adjacent UUIDs land on visually distinct hues
		let hash = 0;
		for (const c of topicId) hash = (hash * 131 + c.charCodeAt(0)) & 0xffffffff;
		// Spread across full hue circle with golden angle for better separation
		return Math.floor((((Math.abs(hash) * 137.508) % 360) + 360) % 360);
	}

	function topicTint(topicId: string | undefined | null) {
		if (!topicId) return 'transparent';
		return `hsla(${topicHue(topicId)}, 60%, 50%, 0.2)`;
	}

	function topicChipBg(topicId: string) {
		return `hsl(${topicHue(topicId)}, 55%, 32%)`;
	}
</script>

<div class="explorer">
	<div class="channel-picker">
		<ComboBox
			labelText="Channel"
			placeholder="Search channels..."
			items={channelItems}
			shouldFilterItem={(item, value) =>
				!value || item.text.toLowerCase().includes(value.toLowerCase())}
			on:select={(e) => {
				const item = e.detail.selectedItem;
				if (item?.id) selectChannel(item.id);
			}}
		/>
	</div>

	<div class="chat-wrapper">
		<div class="chat-window" bind:this={chatEl}>
			<div class="sentinel" bind:this={sentinelEl}></div>

			{#if !selectedChannelId && !loading}
				<div class="empty-state">
					<p>Select a channel to start exploring messages</p>
				</div>
			{/if}

			{#if loading && msgs.length > 0}
				<div class="top-loading">
					<InlineLoading description="Loading older messages..." />
				</div>
			{/if}

			{#if !hasMore && msgs.length > 0}
				<p class="start-label">— Beginning of channel —</p>
			{/if}

			{#if loading && msgs.length === 0}
				<div class="center-loading">
					<InlineLoading description="Loading messages..." />
				</div>
			{/if}

			{#if selectedChannelId && !loading && msgs.length === 0}
				<div class="empty-state">
					<p>No messages in this channel</p>
				</div>
			{/if}

			{#each msgs as msg (msg.messageId)}
				<div
					class="message"
					data-mid={msg.messageId}
					style="--topic-bg: {topicTint(msg.topic?.topicId)}"
				>
					<div class="message-body">
						{#if msg.reply}
							<div class="reply-preview">
								<button
									class="reply-jump"
									type="button"
									onclick={() => scrollToMessage(msg.reply!.messageId)}
									title="Jump to message"
								>
									<span class="reply-arrow">↩</span>
								</button>
								<a class="reply-author" href={resolve(`/userdata/${msg.reply.vestibuleUserId}`)}
									>@{msg.reply.username}</a
								>
								<button
									class="reply-jump reply-content"
									type="button"
									onclick={() => scrollToMessage(msg.reply!.messageId)}
									title="Jump to message"
								>
									{msg.reply.content}
								</button>
							</div>
						{/if}
						<div class="message-header">
							<a class="display-name" href={resolve(`/userdata/${msg.vestibuleUserId}`)}
								>{msg.displayName}</a
							>
							<a class="username" href={resolve(`/userdata/${msg.vestibuleUserId}`)}
								>@{msg.username}</a
							>
							<span class="timestamp">{formatDate(msg.sentAt)}</span>
							{#if msg.topic}
								<span class="topic-chip" style="background-color: {topicChipBg(msg.topic.topicId)}">
									{msg.topic.topicName}
								</span>
							{/if}
						</div>
						<p class="content">{msg.content}</p>
						{#if msg.attachments.length > 0}
							<div class="attachments">
								{#each msg.attachments as att (att.objectKey)}
									<div class="attachment">
										<span>📎</span>
										<span class="att-name">{fileName(att.objectKey)}</span>
										<span class="att-type">{att.contentType}</span>
										{#if att.sizeBytes}
											<span class="att-size">{(att.sizeBytes / 1024).toFixed(1)} KB</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
						{#if msg.reactions.length > 0}
							<div class="reactions">
								{#each msg.reactions as rx (rx)}
									<div class="reaction-wrap">
										<Tag size="sm" type="cool-gray">
											{#if rx.url}
												<img
													src={rx.url}
													alt={rx.displayName ?? ''}
													height="14"
													style="vertical-align:middle"
												/>
											{:else}
												{emojiLabel(rx)}
											{/if}
											&nbsp;{rx.count}
										</Tag>
										<div class="reactor-popover">
											<div class="reactor-popover-header">Reacted by</div>
											{#each rx.reactors as r (r.vestibuleUserId)}
												<a class="reactor-link" href={resolve(`/userdata/${r.vestibuleUserId}`)}
													>@{r.username}</a
												>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.explorer {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 11rem);
		gap: 1rem;
	}

	.channel-picker {
		flex-shrink: 0;
	}

	.chat-wrapper {
		flex: 1;
		min-height: 0;
		border: 1px solid var(--cds-border-subtle-01, #393939);
	}

	.chat-window {
		height: 100%;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		background: var(--cds-layer-01, #262626);
	}

	.sentinel {
		height: 1px;
		flex-shrink: 0;
	}

	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.875rem;
	}

	.empty-state p {
		margin: 0;
	}

	.center-loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.top-loading {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0;
	}

	.center-loading :global(.bx--inline-loading),
	.top-loading :global(.bx--inline-loading) {
		width: auto;
	}

	.start-label {
		text-align: center;
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.75rem;
		margin: 0.5rem 0;
	}

	.message {
		display: flex;
		gap: 0.75rem;
		padding: 0.375rem 0.5rem;
		border-radius: 4px;
		background-color: var(--topic-bg, transparent);
	}

	.message:hover {
		background-color: var(--cds-layer-02, #333333);
	}

	.message:global(.highlighted) {
		background: var(--cds-layer-selected-01, #525252);
		transition: background 1s ease-out;
	}

	.reply-preview {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 100%;
		padding: 0.15rem 0.5rem;
		margin-bottom: 0.25rem;
		border-left: 2px solid var(--cds-border-strong-01, #6f6f6f);
		color: var(--cds-text-secondary, #c6c6c6);
		font-size: 0.75rem;
		overflow: hidden;
	}

	.reply-preview:hover {
		border-left-color: var(--cds-link-01, #78a9ff);
	}

	.reply-jump {
		background: transparent;
		border: none;
		padding: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}

	.reply-jump:hover {
		color: var(--cds-link-01, #78a9ff);
	}

	.reply-arrow {
		font-size: 0.7rem;
		flex-shrink: 0;
	}

	.reply-author {
		font-weight: 600;
		flex-shrink: 0;
		color: var(--cds-text-secondary, #c6c6c6);
		text-decoration: none;
	}

	.reply-author:hover {
		text-decoration: underline;
		color: var(--cds-link-01, #78a9ff);
	}

	.reply-content {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.8;
	}

	.reaction-wrap {
		position: relative;
	}

	.reactor-popover {
		display: flex;
		visibility: hidden;
		opacity: 0;
		pointer-events: none;
		position: absolute;
		bottom: 100%;
		left: 0;
		z-index: 10;
		min-width: 8rem;
		max-width: 14rem;
		padding: 0.5rem;
		background: var(--cds-layer-03, #525252);
		border: 1px solid var(--cds-border-subtle-02, #525252);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
		flex-direction: column;
		gap: 0.15rem;
		transition:
			visibility 0s linear 0.5s,
			opacity 0.15s ease-out 0.5s;
	}

	/* Invisible bridge so cursor can cross from tag to popover without losing hover */
	.reactor-popover::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -8px;
		height: 8px;
	}

	.reaction-wrap:hover .reactor-popover,
	.reactor-popover:hover {
		visibility: visible;
		opacity: 1;
		pointer-events: auto;
		transition:
			visibility 0s linear 0s,
			opacity 0.15s ease-out 0s;
	}

	.reactor-popover-header {
		font-size: 0.7rem;
		color: var(--cds-text-helper, #a8a8a8);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid var(--cds-border-subtle-01, #393939);
		margin-bottom: 0.15rem;
	}

	.reactor-link {
		font-size: 0.75rem;
		color: var(--cds-link-01, #78a9ff);
		text-decoration: none;
		padding: 0.15rem 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.reactor-link:hover {
		text-decoration: underline;
	}

	.message-body {
		flex: 1;
		min-width: 0;
	}

	.message-header {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}

	.display-name {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--cds-text-primary, #f4f4f4);
		text-decoration: none;
	}

	.display-name:hover {
		text-decoration: underline;
		color: var(--cds-link-01, #78a9ff);
	}

	.username {
		font-size: 0.75rem;
		color: var(--cds-text-secondary, #c6c6c6);
		text-decoration: none;
	}

	.username:hover {
		text-decoration: underline;
		color: var(--cds-link-01, #78a9ff);
	}

	.timestamp {
		font-size: 0.7rem;
		color: var(--cds-text-helper, #a8a8a8);
	}

	.topic-chip {
		margin-left: auto;
		padding: 0.05rem 0.5rem;
		border-radius: 10px;
		font-size: 0.65rem;
		font-weight: 500;
		color: #fff;
		text-transform: lowercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.content {
		color: var(--cds-text-primary, #f4f4f4);
		font-size: 0.875rem;
		line-height: 1.5;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.attachments {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}

	.attachment {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--cds-layer-02, #333333);
		border: 1px solid var(--cds-border-subtle-01, #393939);
		border-radius: 4px;
		flex-wrap: wrap;
	}

	.att-name {
		color: var(--cds-link-01, #78a9ff);
		font-weight: 500;
	}

	.att-type,
	.att-size {
		color: var(--cds-text-secondary, #c6c6c6);
	}

	.att-size {
		margin-left: auto;
	}

	.reactions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.375rem;
	}

	@media (max-width: 672px) {
		.explorer {
			height: calc(100vh - 8rem);
		}

		.message {
			gap: 0.5rem;
		}
	}
</style>
