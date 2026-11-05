import type { PageServerLoad } from './$types';
import type { ChartTabularData } from '@carbon/charts-svelte';
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import db from '$lib';
import { discordAccounts, messages, discordChannels } from '$lib/server/db/schema';
import { loadFailed } from '$lib/server/http/errors';

// All bucketing is done on UTC wall-clock time (`timestamptz AT TIME ZONE
// 'UTC'` -> timestamp), so results do not depend on the session TimeZone of
// the database connection and generate_series never crosses a DST change.
const nowUtc = sql`(now() AT TIME ZONE 'UTC')`;
const sentAtUtc = sql`(${messages.sentAt} AT TIME ZONE 'UTC')`;
const hourOfDayUtc = sql`EXTRACT(HOUR FROM ${sentAtUtc})`;

// Every count on this page excludes deleted messages (deleted_at IS NULL).
// That also excludes the placeholder rows ingest inserts for reply parents
// that no longer exist (sent_at = deleted_at = 1970-01-01 UTC).
export const load: PageServerLoad = async () => {
	try {
		const [
			twofourHoursData,
			totalMessagesprevTwoFourH,
			totalMessages,
			mostActiveUserTwoFourH,
			mostActiveUsersEver,
			allTimeChart,
			channelTypeCounts,
			messageAmountPerChannel,
			totalHourlyMessages
		] = await Promise.all([
			// messages per hour for the last 24 hours (0 = current hour)
			db.execute<{ hour: number; count: number }>(sql`
				WITH counts AS (
					SELECT date_trunc('hour', ${sentAtUtc}) AS hour, COUNT(*)::int AS count
					FROM ${messages}
					WHERE ${messages.deletedAt} IS NULL
					  AND ${messages.sentAt} >= (date_trunc('hour', ${nowUtc}) - interval '23 hours') AT TIME ZONE 'UTC'
					GROUP BY 1
				)
				SELECT
					(EXTRACT(EPOCH FROM (date_trunc('hour', ${nowUtc}) - series.hour)) / 3600)::int AS hour,
					COALESCE(counts.count, 0)::int AS count
				FROM generate_series(
					date_trunc('hour', ${nowUtc}) - interval '23 hours',
					date_trunc('hour', ${nowUtc}),
					interval '1 hour'
				) AS series(hour)
				LEFT JOIN counts ON counts.hour = series.hour
				ORDER BY series.hour ASC
			`),

			db.execute<{ count: number }>(sql`
				SELECT COUNT(*)::int AS count
				FROM ${messages}
				WHERE ${messages.deletedAt} IS NULL
				  AND ${messages.sentAt} >= now() - interval '48 hours'
				  AND ${messages.sentAt} < now() - interval '24 hours'
			`),

			db.select({ count: count() }).from(messages).where(isNull(messages.deletedAt)),

			db
				.select({
					username: discordAccounts.username,
					messageCount: count(messages.messageId)
				})
				.from(messages)
				.innerJoin(discordAccounts, eq(messages.sentBy, discordAccounts.discordUserId))
				.where(
					and(
						gte(messages.sentAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
						isNull(messages.deletedAt)
					)
				)
				.groupBy(discordAccounts.discordUserId, discordAccounts.displayName)
				.orderBy(desc(count(messages.messageId)))
				.limit(10),

			db
				.select({
					username: discordAccounts.username,
					messageCount: count(messages.messageId)
				})
				.from(messages)
				.innerJoin(discordAccounts, eq(messages.sentBy, discordAccounts.discordUserId))
				.where(isNull(messages.deletedAt))
				.groupBy(discordAccounts.discordUserId, discordAccounts.displayName)
				.orderBy(desc(count(messages.messageId)))
				.limit(10),

			// messages per UTC day since the first message (0 = today)
			db.execute<{ day: number; count: number }>(sql`
				WITH counts AS (
					SELECT date_trunc('day', ${sentAtUtc}) AS day, COUNT(*)::int AS count
					FROM ${messages}
					WHERE ${messages.deletedAt} IS NULL
					GROUP BY 1
				),
				bounds AS (SELECT MIN(day) AS first_day FROM counts)
				SELECT
					(date_trunc('day', ${nowUtc})::date - series.day::date)::int AS day,
					COALESCE(counts.count, 0)::int AS count
				FROM bounds,
				generate_series(bounds.first_day, date_trunc('day', ${nowUtc}), interval '1 day') AS series(day)
				LEFT JOIN counts ON counts.day = series.day
				ORDER BY series.day ASC
			`),

			db
				.select({
					type: discordChannels.channelType,
					amount: sql<number>`COUNT(*)::int`
				})
				.from(discordChannels)
				.groupBy(discordChannels.channelType),

			db
				.select({
					name: discordChannels.name,
					amount: count(messages.messageId)
				})
				.from(messages)
				.innerJoin(discordChannels, eq(messages.channelId, discordChannels.channelId))
				.where(isNull(messages.deletedAt))
				.groupBy(discordChannels.channelId, discordChannels.name)
				.orderBy(desc(count(messages.messageId))),

			// hour of the day in UTC (the chart axis says UTC)
			db
				.select({
					hour: sql<number>`${hourOfDayUtc}`,
					messageAmount: count(messages.messageId)
				})
				.from(messages)
				.where(isNull(messages.deletedAt))
				.groupBy(hourOfDayUtc)
				.orderBy(hourOfDayUtc)
		]);

		const totalMessagesLasttwoFourH: number = twofourHoursData.reduce(
			(accumulator, currentValue) => accumulator + currentValue.count,
			0
		);

		return {
			twentyfourHourChart: twofourHoursData as ChartTabularData,
			totalMessages: totalMessages[0].count,
			totalMessagesLasttwoFourH: totalMessagesLasttwoFourH,
			totalMessagesprevTwoFourH: totalMessagesprevTwoFourH[0].count,
			mostActiveUserTwoFourH: mostActiveUserTwoFourH,
			allTimeChart: allTimeChart as ChartTabularData,
			channelTypeCounts: channelTypeCounts.map((e) => {
				return {
					group: e.type,
					value: e.amount
				};
			}) as ChartTabularData,
			mostActiveUsersEver,
			messageAmountPerChannel: messageAmountPerChannel.map((e) => {
				return {
					group: e.name,
					value: e.amount
				};
			}) as ChartTabularData,
			totalHourlyMessages: totalHourlyMessages as ChartTabularData
		};
	} catch (e: unknown) {
		return loadFailed('overview', e);
	}
};
