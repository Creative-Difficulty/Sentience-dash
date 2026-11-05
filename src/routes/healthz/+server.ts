import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };

/**
 * Liveness probe used by the Docker HEALTHCHECK: 200 when the server is up.
 * `?db=1` additionally runs `SELECT 1` and answers 503 if the database is
 * unreachable (the error itself is logged, never returned to the client).
 */
export const GET: RequestHandler = async ({ url }) => {
	if (url.searchParams.get('db') !== '1') return new Response('ok\n', { headers });
	try {
		await getDb().execute(sql`SELECT 1`);
		return new Response('ok db\n', { headers });
	} catch (e) {
		console.error('healthz: database check failed', e);
		return new Response('db unavailable\n', { status: 503, headers });
	}
};
