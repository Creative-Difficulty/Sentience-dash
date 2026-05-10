import type { PageServerLoad } from './$types';
import { count, gte, isNull, sql, desc, eq } from "drizzle-orm";
import db from "$lib";
import { discordAccounts, messages, discordChannels } from "$lib/server/db/schema";
import { type ChartTabularData } from "@carbon/charts-svelte";
import { and } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
    try {
        const twofourHoursData = await db.execute<{ hour: number; count: number }>(sql`
            SELECT
                EXTRACT(EPOCH FROM (date_trunc('hour', now()) - series.hour))::int / 3600
                    AS hour,
                COUNT(${messages.sentAt})::int AS count
            FROM generate_series(
                date_trunc('hour', now()) - interval '23 hours',
                date_trunc('hour', now()),
                interval '1 hour'
            ) AS series(hour)
            LEFT JOIN ${messages}
                ON date_trunc('hour', ${messages.sentAt}) = series.hour
            GROUP BY series.hour
            ORDER BY series.hour ASC
        `);

        const totalMessagesLasttwoFourH: number = twofourHoursData.reduce((accumulator, currentValue) => accumulator + currentValue.count, 0);

        const totalMessagesprevTwoFourH = await db.execute<{ count: number }>(sql`
            SELECT COUNT(*)::int AS count
            FROM ${messages}
            WHERE ${messages.sentAt} >= now() - interval '48 hours'
            AND ${messages.sentAt} < now() - interval '24 hours'
        `);

        const totalMessages = await db
            .select({
                count: count(),
            })
            .from(messages)
            .where(isNull(messages.deletedAt));


        const mostActiveUserTwoFourH = await db
            .select({
                username: discordAccounts.username,
                messageCount: count(messages.messageId),
            })
            .from(messages)
            .innerJoin(discordAccounts, eq(messages.sentBy, discordAccounts.discordUserId))
            .where(
                and(
                    gte(messages.sentAt, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
                    isNull(messages.deletedAt))
            )
            .groupBy(discordAccounts.discordUserId, discordAccounts.displayName)
            .orderBy(desc(count(messages.messageId)))
            .limit(10);


        const mostActiveUsersEver = await db
            .select({
                username: discordAccounts.username,
                messageCount: count(messages.messageId),
            })
            .from(messages)
            .innerJoin(discordAccounts, eq(messages.sentBy, discordAccounts.discordUserId))
            .where(
                isNull(messages.deletedAt)
            )
            .groupBy(discordAccounts.discordUserId, discordAccounts.displayName)
            .orderBy(desc(count(messages.messageId)))
            .limit(10);


        // We exclude 1.1.1970 because that's what we set the sent_at of deleted messages to
        const allTimeChart = await db.execute<{ day: number; count: number }>(sql`
            WITH bounds AS (
                SELECT date_trunc('day', MIN(${messages.sentAt})) AS first_day
                FROM ${messages}
                WHERE ${messages.sentAt} != TIMESTAMP '1970-01-01 00:00:00'
            )
            SELECT
                EXTRACT(
                    EPOCH FROM (
                        date_trunc('day', now()) - series.day
                    )
                )::int / 86400 AS day,
                COUNT(${messages.sentAt})::int AS count
            FROM bounds,
            generate_series(
                bounds.first_day,
                date_trunc('day', now()),
                interval '1 day'
            ) AS series(day)
            LEFT JOIN ${messages}
                ON date_trunc('day', ${messages.sentAt}) = series.day
                AND ${messages.sentAt} != TIMESTAMP '1970-01-01 00:00:00'
            GROUP BY series.day
            ORDER BY series.day ASC
        `);

        const channelTypeCounts = await db
            .select({
                type: discordChannels.channelType,
                amount: sql<number>`COUNT(*)::int`,
            })
            .from(discordChannels)
            .groupBy(discordChannels.channelType);

        const messageAmountPerChannel = await db
            .select({
                name: discordChannels.name,
                amount: count(messages.messageId),
            })
            .from(messages)
            .innerJoin(discordChannels, eq(messages.channelId, discordChannels.channelId))
            .where(isNull(messages.deletedAt))
            .groupBy(discordChannels.channelId, discordChannels.name)
            .orderBy(desc(count(messages.messageId)));

        const totalHourlyMessages = await db
            .select({
                hour: sql<number>`EXTRACT(HOUR FROM ${messages.sentAt})`,
                messageAmount: count(messages.messageId),
            })
            .from(messages)
            .where(isNull(messages.deletedAt))
            .groupBy(sql`EXTRACT(HOUR FROM ${messages.sentAt})`)
            .orderBy(sql`EXTRACT(HOUR FROM ${messages.sentAt})`);

        return {
            twentyfourHourChart: twofourHoursData as ChartTabularData,
            totalMessages: totalMessages[0].count,
            totalMessagesLasttwoFourH: totalMessagesLasttwoFourH,
            totalMessagesprevTwoFourH: totalMessagesprevTwoFourH[0].count,
            mostActiveUserTwoFourH: mostActiveUserTwoFourH,
            allTimeChart: allTimeChart as ChartTabularData,
            channelTypeCounts: (channelTypeCounts.map((e) => {
                return {
                    group: e.type,
                    value: e.amount
                };
            })) as ChartTabularData,
            mostActiveUsersEver,
            messageAmountPerChannel: (messageAmountPerChannel.map((e) => {
                return {
                    group: e.name,
                    value: e.amount
                };
            })) as ChartTabularData,
            totalHourlyMessages: totalHourlyMessages as ChartTabularData
        };

    } catch (e: unknown) {
        if (e instanceof Error) {
            return { error: e.toString() };
        }
    };
}