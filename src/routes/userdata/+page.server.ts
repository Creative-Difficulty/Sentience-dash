import type { PageServerLoad } from './$types';
import db from '$lib';
import { discordAccounts, messages } from '$lib/server/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	try {
		const users = await db
			.select({
				discordUserId: sql<string>`${discordAccounts.discordUserId}::text`,
				username: discordAccounts.username,
				displayName: discordAccounts.displayName,
				vestibuleUserId: discordAccounts.vestibuleUserId,
				messageCount: sql<number>`COUNT(${messages.messageId})::int`
			})
			.from(discordAccounts)
			.leftJoin(
				messages,
				and(eq(messages.sentBy, discordAccounts.discordUserId), isNull(messages.deletedAt))
			)
			.groupBy(
				discordAccounts.discordUserId,
				discordAccounts.username,
				discordAccounts.displayName,
				discordAccounts.vestibuleUserId
			)
			.orderBy(sql`COUNT(${messages.messageId}) DESC`);

		return { users };
	} catch (e: unknown) {
		if (e instanceof Error) return { error: e.toString() };
	}
};
