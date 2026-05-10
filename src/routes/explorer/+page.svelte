<script lang="ts">
	let messages = [
		{
			id: '1',
			role: 'user',
			content: 'Can you review the API response format?',
			createdAt: '2026-05-10T10:00:00Z',
			reactions: { like: 2 },
			attachments: [
				{
					id: 'a1',
					type: 'file',
					name: 'api-spec.pdf',
					url: '#'
				}
			]
		},
		{
			id: '2',
			role: 'assistant',
			content:
				'Yes. The response structure is mostly consistent, but pagination is missing metadata.',
			createdAt: '2026-05-10T10:01:00Z',
			reactions: { heart: 1, like: 3 }
		}
	];

	const formatTime = (iso: string) =>
		new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
</script>

<div class="chat">
	{#each messages as msg (msg.id)}
		<div class="row {msg.role}">
			<div class="bubble">
				<div class="meta">
					<span class="role">{msg.role}</span>
					<span class="time">{formatTime(msg.createdAt)}</span>
				</div>

				<div class="content">{msg.content}</div>

				{#if msg.attachments?.length}
					<div class="attachments">
						{#each msg.attachments as a (a.id)}
							<a class="attachment" href={resolve(a.url)}>
								{#if a.type === 'image'}
									<img src={a.thumbnailUrl ?? a.url} alt={a.name} />
								{:else}
									📎 {a.name}
								{/if}
							</a>
						{/each}
					</div>
				{/if}

				{#if msg.reactions}
					<div class="reactions">
						{#if msg.reactions.like}
							<span>👍 {msg.reactions.like}</span>
						{/if}
						{#if msg.reactions.laugh}
							<span>😂 {msg.reactions.laugh}</span>
						{/if}
						{#if msg.reactions.heart}
							<span>❤️ {msg.reactions.heart}</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		max-width: 800px;
		margin: 0 auto;
	}

	.row {
		display: flex;
	}

	.row.user {
		justify-content: flex-end;
	}

	.row.assistant {
		justify-content: flex-start;
	}

	.bubble {
		max-width: 70%;
		padding: 10px 12px;
		border-radius: 12px;
		background: #f4f4f4;
	}

	.row.user .bubble {
		background: #d0e2ff;
	}

	.meta {
		font-size: 11px;
		opacity: 0.6;
		display: flex;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.content {
		font-size: 14px;
		white-space: pre-wrap;
	}

	.attachments {
		margin-top: 8px;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.attachment {
		font-size: 12px;
		padding: 4px 6px;
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
		text-decoration: none;
	}

	.reactions {
		margin-top: 6px;
		font-size: 12px;
		opacity: 0.8;
		display: flex;
		gap: 10px;
	}
</style>
