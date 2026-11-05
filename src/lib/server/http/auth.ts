// Optional HTTP Basic authentication for the whole dashboard.
// Enabled only when both DASH_BASIC_AUTH_USER and DASH_BASIC_AUTH_PASSWORD
// are set. Pure functions so they can be unit tested.
import { createHash, timingSafeEqual } from 'node:crypto';

export type BasicAuthConfig =
	| { mode: 'off' }
	| { mode: 'on'; user: string; password: string }
	| { mode: 'misconfigured' };

export function basicAuthConfig(env: Record<string, string | undefined>): BasicAuthConfig {
	const user = env.DASH_BASIC_AUTH_USER ?? '';
	const password = env.DASH_BASIC_AUTH_PASSWORD ?? '';
	if (!user && !password) return { mode: 'off' };
	if (!user || !password) return { mode: 'misconfigured' };
	return { mode: 'on', user, password };
}

/** Constant-time string comparison (hashing first makes lengths equal). */
export function safeEqual(a: string, b: string): boolean {
	const ha = createHash('sha256').update(a).digest();
	const hb = createHash('sha256').update(b).digest();
	return timingSafeEqual(ha, hb);
}

/** Checks an `Authorization` header value against the expected credentials. */
export function checkBasicAuth(header: string | null, user: string, password: string): boolean {
	if (!header) return false;
	const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
	if (!match) return false;
	const decoded = Buffer.from(match[1], 'base64').toString('utf8');
	const sep = decoded.indexOf(':');
	if (sep < 0) return false;
	// evaluate both comparisons so timing does not reveal which one failed
	const userOk = safeEqual(decoded.slice(0, sep), user);
	const passOk = safeEqual(decoded.slice(sep + 1), password);
	return userOk && passOk;
}
