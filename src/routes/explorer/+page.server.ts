import type { PageServerLoad } from './$types';
import db from '$lib';
import { discordChannels } from '$lib/server/db/schema';
import { asc, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	try {
		const channels = await db
			.select({
				channelId: sql<string>`${discordChannels.channelId}::text`,
				name: discordChannels.name,
				channelType: discordChannels.channelType
			})
			.from(discordChannels)
			.orderBy(asc(discordChannels.name));

		return { channels };
	} catch (e: unknown) {
		if (e instanceof Error) return { error: e.toString() };
	}
};
