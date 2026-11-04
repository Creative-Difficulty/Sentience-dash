// Security headers added to every response rendered by SvelteKit.
// The Content-Security-Policy itself is configured in svelte.config.js
// (kit.csp) so SvelteKit can add nonces for its own inline bootstrap script.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'no-referrer',
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Resource-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
};

export function applySecurityHeaders(headers: Headers): void {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!headers.has(name)) headers.set(name, value);
	}
}
