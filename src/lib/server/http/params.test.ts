import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isUuid, parseMessagesQuery, parseSnowflake } from './params';

const NUM_RUNS = Number(process.env.FC_NUM_RUNS ?? 2000);
const INT64_MAX = 2n ** 63n - 1n;

describe('parseSnowflake', () => {
	it.each([
		['1', '1'],
		['1001', '1001'],
		['200000000000000001', '200000000000000001'],
		['9223372036854775807', '9223372036854775807']
	])('accepts %s', (input, out) => {
		expect(parseSnowflake(input)).toBe(out);
	});

	it.each([
		null,
		undefined,
		'',
		'0',
		'-1',
		'+1',
		'01',
		' 1',
		'1 ',
		'1.0',
		'1e3',
		'0x10',
		'abc',
		'１２３',
		'9223372036854775808',
		'99999999999999999999',
		"1001' OR '1'='1"
	])('rejects %j', (input) => {
		expect(parseSnowflake(input)).toBeNull();
	});

	it('property: every positive int64 round-trips unchanged', () => {
		fc.assert(
			fc.property(fc.bigInt({ min: 1n, max: INT64_MAX }), (n) => {
				expect(parseSnowflake(n.toString())).toBe(n.toString());
			}),
			{ numRuns: NUM_RUNS }
		);
	});

	it('property: anything accepted is a canonical positive int64', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					fc.string(),
					fc.stringMatching(/^-?[0-9]{1,22}$/),
					fc.bigInt({ min: -(2n ** 70n), max: 2n ** 70n }).map(String)
				),
				(s) => {
					const r = parseSnowflake(s);
					if (r === null) return;
					expect(r).toBe(s);
					const n = BigInt(r);
					expect(n >= 1n && n <= INT64_MAX).toBe(true);
					expect(n.toString()).toBe(r);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('isUuid', () => {
	it('accepts canonical UUIDs in any case', () => {
		expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
		expect(isUuid('FFFFFFFF-FFFF-4FFF-8FFF-FFFFFFFFFFFF')).toBe(true);
	});
	it.each([
		null,
		undefined,
		'',
		'abc',
		'00000000000040008000000000000001',
		'{00000000-0000-4000-8000-000000000001}',
		'00000000-0000-4000-8000-00000000000g',
		'00000000-0000-4000-8000-0000000000011',
		' 00000000-0000-4000-8000-000000000001'
	])('rejects %j', (v) => {
		expect(isUuid(v)).toBe(false);
	});
	it('property: fast-check uuids are accepted, mutated ones rejected', () => {
		fc.assert(
			fc.property(fc.uuid(), fc.nat({ max: 35 }), (u, i) => {
				expect(isUuid(u)).toBe(true);
				const broken = u.slice(0, i) + 'z' + u.slice(i + 1);
				expect(isUuid(broken)).toBe(false);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('parseMessagesQuery', () => {
	const q = (s: string) => parseMessagesQuery(new URLSearchParams(s));

	it('requires channelId', () => {
		expect(q('')).toEqual({ ok: false, message: 'channelId required' });
		expect(q('channelId=')).toEqual({ ok: false, message: 'channelId required' });
	});
	it('validates channelId', () => {
		expect(q('channelId=abc')).toEqual({
			ok: false,
			message: 'channelId must be a positive 64-bit integer'
		});
	});
	it('before is optional', () => {
		expect(q('channelId=1001')).toEqual({ ok: true, channelId: '1001', before: null });
		expect(q('channelId=1001&before=')).toEqual({ ok: true, channelId: '1001', before: null });
	});
	it('validates before', () => {
		expect(q('channelId=1001&before=x')).toEqual({
			ok: false,
			message: 'before must be a positive 64-bit integer'
		});
		expect(q('channelId=1001&before=200000000000000050')).toEqual({
			ok: true,
			channelId: '1001',
			before: '200000000000000050'
		});
	});
	it('property: result is ok exactly when both params are valid', () => {
		const param = fc.oneof(
			fc.constant(null),
			fc.string(),
			fc.bigInt({ min: -10n, max: 2n ** 64n }).map(String)
		);
		fc.assert(
			fc.property(param, param, (channel, before) => {
				const sp = new URLSearchParams();
				if (channel !== null) sp.set('channelId', channel);
				if (before !== null) sp.set('before', before);
				const r = parseMessagesQuery(sp);
				const channelOk = channel !== null && parseSnowflake(channel) !== null;
				const beforeOk = before === null || before === '' || parseSnowflake(before) !== null;
				expect(r.ok).toBe(channelOk && beforeOk);
				if (r.ok) {
					expect(r.channelId).toBe(channel);
					expect(r.before).toBe(before ? before : null);
				}
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});
