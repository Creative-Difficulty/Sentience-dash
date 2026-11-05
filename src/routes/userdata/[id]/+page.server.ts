import type { PageServerLoad } from './$types';
import db from '$lib';
import {
	vestibuleUsers,
	discordAccounts,
	messages,
	discordChannels,
	userFactsAndActivities
} from '$lib/server/db/schema';
import { eq, and, inArray, isNull, sql, desc } from 'drizzle-orm';
import { error, isHttpError } from '@sveltejs/kit';
import { isUuid } from '$lib/server/http/params';
import { loadFailed } from '$lib/server/http/errors';

const MESSAGE_LIMIT = 1000;

export const load: PageServerLoad = async ({ params }) => {
	const userId = params.id;
	// not a UUID -> cannot exist; also avoids a Postgres "invalid input syntax" error
	if (!isUuid(userId)) error(404, 'User not found');

	try {
		const user = await db
			.select({
				id: vestibuleUsers.id,
				nickname: vestibuleUsers.nickname
			})
			.from(vestibuleUsers)
			.where(eq(vestibuleUsers.id, userId))
			.limit(1);

		if (!user.length) error(404, 'User not found');

		const facts = await db
			.select({
				id: userFactsAndActivities.id,
				recordType: userFactsAndActivities.recordType,
				source: userFactsAndActivities.source,
				type: userFactsAndActivities.type,
				value: userFactsAndActivities.value,
				confidence: userFactsAndActivities.confidence,
				level: userFactsAndActivities.level,
				isCurrent: userFactsAndActivities.isCurrent,
				startedAt: userFactsAndActivities.startedAt,
				endedAt: userFactsAndActivities.endedAt,
				createdAt: userFactsAndActivities.createdAt
			})
			.from(userFactsAndActivities)
			.where(eq(userFactsAndActivities.userId, userId))
			.orderBy(desc(userFactsAndActivities.createdAt));

		const accounts = await db
			.select({
				discordUserId: sql<string>`${discordAccounts.discordUserId}::text`,
				username: discordAccounts.username,
				displayName: discordAccounts.displayName
			})
			.from(discordAccounts)
			.where(eq(discordAccounts.vestibuleUserId, userId));

		if (!accounts.length) {
			return { user: user[0], accounts: [], messages: [], facts, truncated: false };
		}

		const accountIds = accounts.map((a) => a.discordUserId);

		const userMessages = await db
			.select({
				messageId: sql<string>`${messages.messageId}::text`,
				content: messages.content,
				sentAt: messages.sentAt,
				channelName: discordChannels.name
			})
			.from(messages)
			.innerJoin(discordChannels, eq(messages.channelId, discordChannels.channelId))
			.where(and(inArray(messages.sentBy, accountIds), isNull(messages.deletedAt)))
			.orderBy(desc(messages.sentAt))
			.limit(MESSAGE_LIMIT + 1);

		const truncated = userMessages.length > MESSAGE_LIMIT;

		return {
			user: user[0],
			accounts,
			messages: userMessages.slice(0, MESSAGE_LIMIT),
			facts,
			truncated
		};
	} catch (e: unknown) {
		// Re-throw SvelteKit errors so 404 etc. work
		if (isHttpError(e)) throw e;
		return loadFailed('userdata/[id]', e);
	}
};
