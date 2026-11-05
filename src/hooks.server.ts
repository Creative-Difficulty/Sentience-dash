import type { Handle, HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { basicAuthConfig, checkBasicAuth } from '$lib/server/http/auth';
import { applySecurityHeaders, SECURITY_HEADERS } from '$lib/server/http/headers';

// Paths reachable without credentials when basic auth is enabled
// (health checks must keep working). Static build assets under /_app are
// served by adapter-node before this hook runs and are always public; they
// contain no data.
const PUBLIC_PATHS = new Set(['/healthz', '/robots.txt']);

export const handle: Handle = async ({ event, resolve }) => {
	const auth = basicAuthConfig(env);
	if (auth.mode !== 'off' && !PUBLIC_PATHS.has(event.url.pathname)) {
		if (auth.mode === 'misconfigured') {
			console.error(
				'DASH_BASIC_AUTH_USER and DASH_BASIC_AUTH_PASSWORD must both be set (or both unset); refusing requests'
			);
			return new Response('Server misconfigured', { status: 500, headers: SECURITY_HEADERS });
		}
		if (!checkBasicAuth(event.request.headers.get('authorization'), auth.user, auth.password)) {
			return new Response('Authentication required', {
				status: 401,
				headers: {
					...SECURITY_HEADERS,
					'WWW-Authenticate': 'Basic realm="Sentience dashboard", charset="UTF-8"',
					'Cache-Control': 'no-store'
				}
			});
		}
	}

	const response = await resolve(event);
	try {
		applySecurityHeaders(response.headers);
	} catch {
		// immutable headers (should not happen for SvelteKit-rendered responses)
	}
	return response;
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	// Full details stay in the server log; the client only gets the generic
	// message SvelteKit chose ("Internal Error" for unexpected errors).
	if (status >= 500)
		console.error(`[${event.request.method} ${event.url.pathname}] ${status}:`, error);
	return { message };
};
