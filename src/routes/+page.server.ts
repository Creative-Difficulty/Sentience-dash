import type { PageServerLoad } from './$types';
import { sql } from "drizzle-orm";
import db from "$lib";
import { messages } from "$lib/server/db/schema";
import { type ChartTabularData } from "@carbon/charts-svelte";

export const load: PageServerLoad = async () => {
    try {
        const result = await db.execute<{ hour: number; count: number }>(sql`
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

        return {
            data: result as ChartTabularData
        };

    } catch (e) {
        return { error: e as string };
    }
};
