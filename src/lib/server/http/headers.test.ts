import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, SECURITY_HEADERS } from './headers';

describe('applySecurityHeaders', () => {
	it('adds every header', () => {
		const h = new Headers();
		applySecurityHeaders(h);
		for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(h.get(k)).toBe(v);
		expect(h.get('x-content-type-options')).toBe('nosniff');
		expect(h.get('x-frame-options')).toBe('DENY');
		expect(h.get('referrer-policy')).toBe('no-referrer');
		expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
		expect(h.get('cross-origin-resource-policy')).toBe('same-origin');
		expect(h.get('permissions-policy')).toContain('camera=()');
	});
	it('does not override a header a route set itself', () => {
		const h = new Headers({ 'Referrer-Policy': 'same-origin' });
		applySecurityHeaders(h);
		expect(h.get('referrer-policy')).toBe('same-origin');
	});
});
