import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	assembleMessages,
	groupAttachments,
	groupReactions,
	groupTopics,
	paginate,
	reactionKey,
	type AttachmentRow,
	type MessageRow,
	type ReactionRow,
	type TopicRow
} from './assemble';

const NUM_RUNS = Number(process.env.FC_NUM_RUNS ?? 2000);

const msg = (id: string, extra: Partial<MessageRow> = {}): MessageRow => ({
	messageId: id,
	content: `content ${id}`,
	sentAt: '2026-01-01 00:00:00+00',
	inReplyTo: null,
	username: 'alice',
	displayName: 'Alice',
	vestibuleUserId: 'u-alice',
	replyUsername: null,
	replyDisplayName: null,
	replyVestibuleUserId: null,
	replyContent: null,
	...extra
});

const rx = (
	messageId: string,
	emojiId: string | null,
	extra: Partial<ReactionRow> = {}
): ReactionRow => ({
	messageId,
	emojiId,
	discordEmojiId: emojiId ? `d-${emojiId}` : null,
	emojiDisplayName: null,
	emojiUrl: null,
	username: 'bob',
	vestibuleUserId: 'u-bob',
	...extra
});

describe('paginate', () => {
	it('returns everything and no cursor when rows fit in one page', () => {
		expect(paginate([{ messageId: '3' }, { messageId: '2' }], 2)).toEqual({
			page: [{ messageId: '3' }, { messageId: '2' }],
			hasMore: false,
			nextCursor: null
		});
	});

	it('drops the look-ahead row and uses the last visible id as cursor', () => {
		expect(paginate([{ messageId: '3' }, { messageId: '2' }, { messageId: '1' }], 2)).toEqual({
			page: [{ messageId: '3' }, { messageId: '2' }],
			hasMore: true,
			nextCursor: '2'
		});
	});

	it('handles an empty result', () => {
		expect(paginate([], 50)).toEqual({ page: [], hasMore: false, nextCursor: null });
	});

	it('property: page is a prefix of rows, bounded by pageSize; cursor iff more', () => {
		fc.assert(
			fc.property(
				fc.array(fc.record({ messageId: fc.bigInt({ min: 1n, max: 2n ** 63n - 1n }).map(String) })),
				fc.integer({ min: 1, max: 60 }),
				(rows, size) => {
					const { page, hasMore, nextCursor } = paginate(rows, size);
					expect(page.length).toBe(Math.min(size, rows.length));
					expect(page).toEqual(rows.slice(0, page.length));
					expect(hasMore).toBe(rows.length > size);
					expect(nextCursor).toBe(hasMore ? page[page.length - 1].messageId : null);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('groupTopics', () => {
	it('keeps the first topic per message', () => {
		const rows: TopicRow[] = [
			{ messageId: '1', topicId: 't1', topicName: 'one' },
			{ messageId: '1', topicId: 't2', topicName: 'two' },
			{ messageId: '2', topicId: 't2', topicName: 'two' }
		];
		const m = groupTopics(rows);
		expect(m.get('1')).toEqual({ topicId: 't1', topicName: 'one' });
		expect(m.get('2')).toEqual({ topicId: 't2', topicName: 'two' });
		expect(m.size).toBe(2);
	});
});

describe('groupAttachments', () => {
	it('groups by message, preserving order', () => {
		const a = (messageId: string, objectKey: string): AttachmentRow => ({
			messageId,
			objectKey,
			contentType: 'image/png',
			sizeBytes: 1
		});
		const m = groupAttachments([a('1', 'x'), a('2', 'y'), a('1', 'z')]);
		expect(m.get('1')!.map((r) => r.objectKey)).toEqual(['x', 'z']);
		expect(m.get('2')!.map((r) => r.objectKey)).toEqual(['y']);
	});

	it('property: every row lands in exactly its own message bucket, in order', () => {
		const row = fc.record({
			messageId: fc.constantFrom('1', '2', '3', '4'),
			contentType: fc.string(),
			objectKey: fc.string(),
			sizeBytes: fc.option(fc.nat(), { nil: null })
		});
		fc.assert(
			fc.property(fc.array(row), (rows) => {
				const m = groupAttachments(rows);
				let total = 0;
				for (const [id, list] of m) {
					expect(list).toEqual(rows.filter((r) => r.messageId === id));
					total += list.length;
				}
				expect(total).toBe(rows.length);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('reactionKey', () => {
	it('prefers the emoji row id', () => {
		expect(reactionKey({ emojiId: 'e1', discordEmojiId: '👍' })).toBe('e1');
	});
	it('falls back to the discord emoji id', () => {
		expect(reactionKey({ emojiId: null, discordEmojiId: '👍' })).toBe('u_👍');
	});
});

describe('groupReactions', () => {
	it('merges reactions of the same emoji and lists reactors', () => {
		const m = groupReactions([
			rx('1', 'e1', { username: 'a', vestibuleUserId: 'ua', emojiDisplayName: 'wave' }),
			rx('1', 'e1', { username: 'b', vestibuleUserId: 'ub' }),
			rx('1', 'e2', { username: 'a', vestibuleUserId: 'ua' }),
			rx('2', 'e1', { username: 'c', vestibuleUserId: 'uc' })
		]);
		const one = [...m.get('1')!.values()];
		expect(one).toEqual([
			{
				discordEmojiId: 'd-e1',
				displayName: 'wave',
				url: null,
				count: 2,
				reactors: [
					{ username: 'a', vestibuleUserId: 'ua' },
					{ username: 'b', vestibuleUserId: 'ub' }
				]
			},
			{
				discordEmojiId: 'd-e2',
				displayName: null,
				url: null,
				count: 1,
				reactors: [{ username: 'a', vestibuleUserId: 'ua' }]
			}
		]);
		expect([...m.get('2')!.values()].map((g) => g.count)).toEqual([1]);
	});

	it('normalises undefined emoji metadata to null', () => {
		const row = {
			...rx('1', 'e1'),
			discordEmojiId: undefined,
			emojiDisplayName: undefined,
			emojiUrl: undefined
		} as unknown as ReactionRow;
		const g = [...groupReactions([row]).get('1')!.values()][0];
		expect(g.discordEmojiId).toBeNull();
		expect(g.displayName).toBeNull();
		expect(g.url).toBeNull();
	});

	it('property: counts equal reactor list lengths and sum to the number of rows', () => {
		const row = fc.record({
			messageId: fc.constantFrom('1', '2', '3'),
			emojiId: fc.option(fc.constantFrom('e1', 'e2', 'e3'), { nil: null }),
			discordEmojiId: fc.option(fc.constantFrom('👍', '🦀', '123'), { nil: null }),
			emojiDisplayName: fc.option(fc.string(), { nil: null }),
			emojiUrl: fc.option(fc.webUrl(), { nil: null }),
			username: fc.string(),
			vestibuleUserId: fc.uuid()
		});
		fc.assert(
			fc.property(fc.array(row, { maxLength: 80 }), (rows) => {
				const m = groupReactions(rows);
				let total = 0;
				for (const [msgId, groups] of m) {
					for (const [key, g] of groups) {
						const members = rows.filter((r) => r.messageId === msgId && reactionKey(r) === key);
						expect(g.count).toBe(members.length);
						expect(g.reactors).toEqual(
							members.map((r) => ({ username: r.username, vestibuleUserId: r.vestibuleUserId }))
						);
						// metadata comes from the first row of the group
						expect(g.discordEmojiId).toBe(members[0].discordEmojiId);
						expect(g.displayName).toBe(members[0].emojiDisplayName);
						expect(g.url).toBe(members[0].emojiUrl);
						total += g.count;
					}
				}
				expect(total).toBe(rows.length);
			}),
			{ numRuns: NUM_RUNS }
		);
	});
});

describe('assembleMessages', () => {
	it('attaches reply preview, attachments, reactions and topic', () => {
		const page = [
			msg('10', {
				inReplyTo: '5',
				replyUsername: 'carol',
				replyDisplayName: 'Carol',
				replyVestibuleUserId: 'u-carol',
				replyContent: 'hi'
			}),
			msg('9')
		];
		const out = assembleMessages(
			page,
			[{ messageId: '10', contentType: 'image/png', objectKey: 'k', sizeBytes: 3 }],
			[rx('10', 'e1')],
			[{ messageId: '9', topicId: 't', topicName: 'ramen' }]
		);
		expect(out).toHaveLength(2);
		expect(out[0].reply).toEqual({
			messageId: '5',
			username: 'carol',
			displayName: 'Carol',
			vestibuleUserId: 'u-carol',
			content: 'hi'
		});
		expect(out[0].attachments).toHaveLength(1);
		expect(out[0].reactions).toHaveLength(1);
		expect(out[0].topic).toBeNull();
		expect(out[1]).toMatchObject({
			messageId: '9',
			content: 'content 9',
			reply: null,
			attachments: [],
			reactions: [],
			topic: { topicId: 't', topicName: 'ramen' }
		});
	});

	it('has no reply preview when the replied-to message was not found', () => {
		const out = assembleMessages([msg('10', { inReplyTo: '5' })], [], [], []);
		expect(out[0].reply).toBeNull();
		expect(out[0].inReplyTo).toBe('5');
	});

	it('uses an empty string when the reply content is null', () => {
		const out = assembleMessages(
			[msg('10', { inReplyTo: '5', replyUsername: 'carol' })],
			[],
			[],
			[]
		);
		expect(out[0].reply?.content).toBe('');
	});

	it('copies every scalar field of the message row', () => {
		const row = msg('42', {
			content: 'c',
			sentAt: 's',
			username: 'u',
			displayName: 'd',
			vestibuleUserId: 'v'
		});
		const [out] = assembleMessages([row], [], [], []);
		expect(out).toEqual({
			messageId: '42',
			content: 'c',
			sentAt: 's',
			inReplyTo: null,
			username: 'u',
			displayName: 'd',
			vestibuleUserId: 'v',
			reply: null,
			attachments: [],
			reactions: [],
			topic: null
		});
	});

	it('property: output preserves page order and length', () => {
		fc.assert(
			fc.property(
				fc.uniqueArray(fc.bigInt({ min: 1n, max: 2n ** 63n - 1n }).map(String)),
				(ids) => {
					const out = assembleMessages(
						ids.map((id) => msg(id)),
						[],
						[],
						[]
					);
					expect(out.map((m) => m.messageId)).toEqual(ids);
				}
			),
			{ numRuns: NUM_RUNS }
		);
	});
});
