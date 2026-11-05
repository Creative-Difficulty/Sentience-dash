// Pure helpers used by /api/messages to turn flat SQL rows into the nested
// message objects the explorer renders. Kept free of database / SvelteKit
// imports so they can be unit-, property- and mutation-tested in isolation.

export type MessageRow = {
	messageId: string;
	content: string;
	sentAt: string;
	inReplyTo: string | null;
	username: string;
	displayName: string;
	vestibuleUserId: string;
	replyUsername: string | null;
	replyDisplayName: string | null;
	replyVestibuleUserId: string | null;
	replyContent: string | null;
};

export type AttachmentRow = {
	messageId: string;
	contentType: string;
	objectKey: string;
	sizeBytes: number | null;
};

export type ReactionRow = {
	messageId: string;
	emojiId: string | null;
	discordEmojiId: string | null;
	emojiDisplayName: string | null;
	emojiUrl: string | null;
	username: string;
	vestibuleUserId: string;
};

export type TopicRow = { messageId: string; topicId: string; topicName: string };

export type Reactor = { username: string; vestibuleUserId: string };
export type ReactionGroup = {
	discordEmojiId: string | null;
	displayName: string | null;
	url: string | null;
	count: number;
	reactors: Reactor[];
};
export type TopicRef = { topicId: string; topicName: string };

export type ReplyPreview = {
	messageId: string;
	username: string;
	displayName: string | null;
	vestibuleUserId: string | null;
	content: string;
};

export type AssembledMessage = {
	messageId: string;
	content: string;
	sentAt: string;
	inReplyTo: string | null;
	username: string;
	displayName: string;
	vestibuleUserId: string;
	reply: ReplyPreview | null;
	attachments: AttachmentRow[];
	reactions: ReactionGroup[];
	topic: TopicRef | null;
};

/**
 * Splits `pageSize + 1` rows (ordered newest first) into the visible page and
 * the cursor for the next request. The extra row only signals "there is more".
 */
export function paginate<T extends { messageId: string }>(rows: readonly T[], pageSize: number) {
	const hasMore = rows.length > pageSize;
	const page = rows.slice(0, pageSize);
	const nextCursor = hasMore ? page[page.length - 1].messageId : null;
	return { page, hasMore, nextCursor };
}

/** First topic seen for a message wins. */
export function groupTopics(rows: readonly TopicRow[]): Map<string, TopicRef> {
	const byMsg = new Map<string, TopicRef>();
	for (const t of rows) {
		if (!byMsg.has(t.messageId)) {
			byMsg.set(t.messageId, { topicId: t.topicId, topicName: t.topicName });
		}
	}
	return byMsg;
}

/** Attachments per message, preserving input order. */
export function groupAttachments(rows: readonly AttachmentRow[]): Map<string, AttachmentRow[]> {
	const byMsg = new Map<string, AttachmentRow[]>();
	for (const a of rows) {
		let list = byMsg.get(a.messageId);
		if (!list) {
			list = [];
			byMsg.set(a.messageId, list);
		}
		list.push(a);
	}
	return byMsg;
}

/** Key under which reactions are merged: the emoji row id, else the Discord emoji id. */
export function reactionKey(r: Pick<ReactionRow, 'emojiId' | 'discordEmojiId'>): string {
	return r.emojiId ?? `u_${r.discordEmojiId}`;
}

/** Reactions per message, merged per emoji with a count and the list of reactors. */
export function groupReactions(
	rows: readonly ReactionRow[]
): Map<string, Map<string, ReactionGroup>> {
	const byMsg = new Map<string, Map<string, ReactionGroup>>();
	for (const r of rows) {
		const key = reactionKey(r);
		let m = byMsg.get(r.messageId);
		if (!m) {
			m = new Map();
			byMsg.set(r.messageId, m);
		}
		let entry = m.get(key);
		if (!entry) {
			entry = {
				discordEmojiId: r.discordEmojiId ?? null,
				displayName: r.emojiDisplayName ?? null,
				url: r.emojiUrl ?? null,
				count: 0,
				reactors: []
			};
			m.set(key, entry);
		}
		entry.count++;
		entry.reactors.push({ username: r.username, vestibuleUserId: r.vestibuleUserId });
	}
	return byMsg;
}

export function assembleMessages(
	page: readonly MessageRow[],
	attachments: readonly AttachmentRow[],
	reactions: readonly ReactionRow[],
	topics: readonly TopicRow[]
): AssembledMessage[] {
	const topicByMsg = groupTopics(topics);
	const attByMsg = groupAttachments(attachments);
	const rxByMsg = groupReactions(reactions);

	return page.map((m) => ({
		messageId: m.messageId,
		content: m.content,
		sentAt: m.sentAt,
		inReplyTo: m.inReplyTo,
		username: m.username,
		displayName: m.displayName,
		vestibuleUserId: m.vestibuleUserId,
		reply:
			m.inReplyTo && m.replyUsername
				? {
						messageId: m.inReplyTo,
						username: m.replyUsername,
						displayName: m.replyDisplayName,
						vestibuleUserId: m.replyVestibuleUserId,
						content: m.replyContent ?? ''
					}
				: null,
		attachments: attByMsg.get(m.messageId) ?? [],
		reactions: [...(rxByMsg.get(m.messageId)?.values() ?? [])],
		topic: topicByMsg.get(m.messageId) ?? null
	}));
}
