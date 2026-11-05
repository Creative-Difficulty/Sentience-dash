// Request parameter validation. Pure functions: no SvelteKit or DB imports.

const INT64_MAX = 9223372036854775807n;
const DECIMAL = /^[1-9][0-9]{0,18}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns `value` if it is a canonical positive int64 in decimal (what a
 * Discord snowflake / Postgres bigint id looks like), otherwise null.
 * The id stays a string: snowflakes do not fit in a JS number.
 */
export function parseSnowflake(value: string | null | undefined): string | null {
	if (typeof value !== 'string' || !DECIMAL.test(value)) return null;
	return BigInt(value) <= INT64_MAX ? value : null;
}

/** True for a canonical (hyphenated, 36 character) UUID of any version. */
export function isUuid(value: string | null | undefined): value is string {
	return typeof value === 'string' && UUID.test(value);
}

export type MessagesQuery =
	| { ok: true; channelId: string; before: string | null }
	| { ok: false; message: string };

/** Validates the query string of GET /api/messages. */
export function parseMessagesQuery(params: URLSearchParams): MessagesQuery {
	const rawChannel = params.get('channelId');
	if (rawChannel === null || rawChannel === '') return { ok: false, message: 'channelId required' };
	const channelId = parseSnowflake(rawChannel);
	if (channelId === null)
		return { ok: false, message: 'channelId must be a positive 64-bit integer' };

	const rawBefore = params.get('before');
	if (rawBefore === null || rawBefore === '') return { ok: true, channelId, before: null };
	const before = parseSnowflake(rawBefore);
	if (before === null) return { ok: false, message: 'before must be a positive 64-bit integer' };
	return { ok: true, channelId, before };
}
