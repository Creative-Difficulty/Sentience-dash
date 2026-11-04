import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib';
import {
	messages,
	discordAccounts,
	messageAttachments,
	mediaAssets,
	messageReactions,
	discordEmojis,
	topicMessageRelation,
	topic
} from '$lib/server/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { assembleMessages, paginate } from '$lib/server/messages/assemble';

const PAGE_SIZE = 50;
const REPLY_PREVIEW_LEN = 120;

export const GET: RequestHandler = async ({ url }) => {
	const channelIdStr = url.searchParams.get('channelId');
	if (!channelIdStr) throw error(400, 'channelId required');

	const beforeStr = url.searchParams.get('before');

	const channelFilter = sql`${messages.channelId} = ${channelIdStr}::bigint`;
	const beforeFilter = beforeStr ? sql`${messages.messageId} < ${beforeStr}::bigint` : undefined;
	const where = beforeFilter
		? and(channelFilter, isNull(messages.deletedAt), beforeFilter)
		: and(channelFilter, isNull(messages.deletedAt));

	const replyMsg = alias(messages, 'reply_msg');
	const replyAccount = alias(discordAccounts, 'reply_account');

	const rows = await db
		.select({
			messageId: sql<string>`${messages.messageId}::text`,
			content: messages.content,
			sentAt: messages.sentAt,
			inReplyTo: sql<string | null>`${messages.inReplyTo}::text`,
			username: discordAccounts.username,
			displayName: discordAccounts.displayName,
			vestibuleUserId: discordAccounts.vestibuleUserId,
			replyUsername: replyAccount.username,
			replyDisplayName: replyAccount.displayName,
			replyVestibuleUserId: replyAccount.vestibuleUserId,
			replyContent: sql<string | null>`LEFT(${replyMsg.content}, ${REPLY_PREVIEW_LEN})`
		})
		.from(messages)
		.innerJoin(discordAccounts, eq(messages.sentBy, discordAccounts.discordUserId))
		.leftJoin(replyMsg, eq(messages.inReplyTo, replyMsg.messageId))
		.leftJoin(replyAccount, eq(replyMsg.sentBy, replyAccount.discordUserId))
		.where(where)
		.orderBy(sql`${messages.messageId} DESC`)
		.limit(PAGE_SIZE + 1);

	const { page, hasMore, nextCursor } = paginate(rows, PAGE_SIZE);

	if (!page.length) return json({ messages: [], hasMore: false, nextCursor: null });

	const ids = page.map((m) => m.messageId);

	const [attRows, rxRows, topicRows] = await Promise.all([
		db
			.select({
				messageId: sql<string>`${messageAttachments.messageId}::text`,
				contentType: mediaAssets.contentType,
				objectKey: mediaAssets.objectKey,
				sizeBytes: mediaAssets.sizeBytes
			})
			.from(messageAttachments)
			.innerJoin(mediaAssets, eq(messageAttachments.assetId, mediaAssets.id))
			.where(
				and(
					sql`${messageAttachments.messageId}::text IN ${ids}`,
					isNull(messageAttachments.deletedAt)
				)
			),
		db
			.select({
				messageId: sql<string>`${messageReactions.messageId}::text`,
				emojiId: messageReactions.emojiId,
				discordEmojiId: discordEmojis.discordEmojiId,
				emojiDisplayName: discordEmojis.emojiDisplayName,
				emojiUrl: discordEmojis.emojiUrl,
				username: discordAccounts.username,
				vestibuleUserId: discordAccounts.vestibuleUserId
			})
			.from(messageReactions)
			.leftJoin(discordEmojis, eq(messageReactions.emojiId, discordEmojis.id))
			.innerJoin(discordAccounts, eq(messageReactions.userId, discordAccounts.discordUserId))
			.where(sql`${messageReactions.messageId}::text IN ${ids}`),
		db
			.select({
				messageId: sql<string>`${topicMessageRelation.messageId}::text`,
				topicId: topicMessageRelation.topicId,
				topicName: topic.name
			})
			.from(topicMessageRelation)
			.innerJoin(topic, eq(topicMessageRelation.topicId, topic.id))
			.where(sql`${topicMessageRelation.messageId}::text IN ${ids}`)
	]);

	const result = assembleMessages(page, attRows, rxRows, topicRows);

	return json({ messages: result, hasMore, nextCursor });
};
