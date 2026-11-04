import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { basicAuthConfig, checkBasicAuth, safeEqual } from './auth';

const NUM_RUNS = Number(process.env.FC_NUM_RUNS ?? 2000);
const header = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

describe('basicAuthConfig', () => {
	it('is off by default', () => {
		expect(basicAuthConfig({})).toEqual({ mode: 'off' });
		expect(basicAuthConfig({ DASH_BASIC_AUTH_USER: '', DASH_BASIC_AUTH_PASSWORD: '' })).toEqual({
			mode: 'off'
		});
	});
	it('is on when both are set', () => {
		expect(basicAuthConfig({ DASH_BASIC_AUTH_USER: 'a', DASH_BASIC_AUTH_PASSWORD: 'b' })).toEqual({
			mode: 'on',
			user: 'a',
			password: 'b'
		});
	});
	it('fails closed when only one is set', () => {
		expect(basicAuthConfig({ DASH_BASIC_AUTH_USER: 'a' })).toEqual({ mode: 'misconfigured' });
		expect(basicAuthConfig({ DASH_BASIC_AUTH_PASSWORD: 'b' })).toEqual({ mode: 'misconfigured' });
	});
});

describe('safeEqual', () => {
	it('compares strings of different lengths without throwing', () => {
		expect(safeEqual('a', 'a')).toBe(true);
		expect(safeEqual('a', 'ab')).toBe(false);
		expect(safeEqual('', '')).toBe(true);
	});
	it('property: agrees with ===', () => {
		fc.assert(
			fc.property(fc.string(), fc.string(), (a, b) => {
				expect(safeEqual(a, b)).toBe(a === b);
				expect(safeEqual(a, a)).toBe(true);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('checkBasicAuth', () => {
	it('accepts the right credentials (password may contain colons)', () => {
		expect(checkBasicAuth(header('admin', 'pa:ss'), 'admin', 'pa:ss')).toBe(true);
		expect(
			checkBasicAuth(header('admin', 'pa:ss').replace('Basic', 'basic'), 'admin', 'pa:ss')
		).toBe(true);
	});
	it.each([
		[null],
		[''],
		['Bearer abc'],
		['Basic'],
		['Basic !!!'],
		[`Basic ${Buffer.from('nocolon').toString('base64')}`],
		[header('admin', 'wrong')],
		[header('wrong', 'pa:ss')],
		[header('admin', 'pa:s')],
		[header('', '')]
	])('rejects %j', (h) => {
		expect(checkBasicAuth(h, 'admin', 'pa:ss')).toBe(false);
	});
	it('is strict about the header shape', () => {
		const b64 = Buffer.from('admin:pa:ss').toString('base64');
		expect(checkBasicAuth(`Basic  ${b64}`, 'admin', 'pa:ss')).toBe(true);
		expect(checkBasicAuth(`XBasic ${b64}`, 'admin', 'pa:ss')).toBe(false);
		expect(checkBasicAuth(`Basic ${b64} trailing`, 'admin', 'pa:ss')).toBe(false);
		expect(checkBasicAuth(`Basic ${b64}!`, 'admin', 'pa:ss')).toBe(false);
	});
	it('requires the user:password separator', () => {
		// without the check, "nocolon" would split into "nocolo" / "nocolon"
		const h = `Basic ${Buffer.from('nocolon').toString('base64')}`;
		expect(checkBasicAuth(h, 'nocolo', 'nocolon')).toBe(false);
	});
	it('property: accepts exactly the configured pair', () => {
		const user = fc.string({ minLength: 1 }).filter((s) => !s.includes(':'));
		fc.assert(
			fc.property(user, fc.string({ minLength: 1 }), user, fc.string(), (u, p, u2, p2) => {
				expect(checkBasicAuth(header(u, p), u, p)).toBe(true);
				expect(checkBasicAuth(header(u2, p2), u, p)).toBe(u2 === u && p2 === p);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
