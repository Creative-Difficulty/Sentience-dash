import { describe, expect, it, vi } from 'vitest';
import { GENERIC_LOAD_ERROR, loadFailed } from './errors';

describe('loadFailed', () => {
	it('logs the real error and returns only a generic message', () => {
		const log = vi.fn();
		const e = new Error('Failed query: select secret from users\nparams: 42');
		const out = loadFailed('overview', e, log);
		expect(out).toEqual({ error: GENERIC_LOAD_ERROR });
		expect(GENERIC_LOAD_ERROR).toMatch(/^Could not load data/);
		expect(JSON.stringify(out)).not.toContain('select');
		expect(log).toHaveBeenCalledWith('[overview] load failed:', e);
	});
	it('handles non-Error throwables', () => {
		const log = vi.fn();
		expect(loadFailed('x', 'boom', log)).toEqual({ error: GENERIC_LOAD_ERROR });
		expect(log).toHaveBeenCalledOnce();
	});
});
