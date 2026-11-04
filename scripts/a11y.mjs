#!/usr/bin/env node
// Runs axe-core against every dashboard page at a desktop and a phone width.
//
// Usage: BASE_URL=http://127.0.0.1:3000 node scripts/a11y.mjs
//
// Env:
//   BASE_URL  app origin                        (default http://127.0.0.1:3000)
//   WIDTHS    comma list of viewport widths      (default 1440,375)
//   USER_ID   vestibule user id for the detail page
//   OUT       optional path to write the full JSON results to
//   CHECK     "1" to exit non-zero on any serious/critical violation that is
//             not a known issue inside a third-party component (see UPSTREAM)
//
// Requires `playwright` (with Chromium) and `axe-core`.

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const WIDTHS = (process.env.WIDTHS ?? '1440,375').split(',').map(Number);
const USER_ID = process.env.USER_ID ?? '00000000-0000-4000-8000-000000000001';

const PAGES = [
	{ name: 'overview', path: '/' },
	{ name: 'explorer', path: '/explorer', prepare: selectChannel },
	{ name: 'userdata', path: '/userdata' },
	{ name: 'userdetail', path: `/userdata/${USER_ID}` }
];

async function selectChannel(page) {
	const input = page.locator('input[role="combobox"]').first();
	await input.focus();
	await input.fill('off-topic');
	await page.locator('[role="option"]').first().waitFor({ state: 'attached' });
	const responded = page.waitForResponse((r) => r.url().includes('/api/messages'));
	await input.press('ArrowDown');
	await input.press('Enter');
	await responded;
	await page.locator('[data-mid]').first().waitFor();
}

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

// Violations that live entirely inside third-party component markup and
// cannot be fixed from this app. They are still reported, marked "upstream",
// but do not fail CHECK=1.
const UPSTREAM = [
	// @carbon/charts toolbar: role="button" wrappers around focusable buttons.
	{ id: 'nested-interactive', within: '.cds--cc--toolbar' },
	// carbon-components-svelte ComboBox: role="listbox" on the wrapper that
	// contains the role="combobox" input, and aria-controls to a closed menu.
	{ id: 'aria-required-children', within: '.bx--combo-box' },
	{ id: 'aria-valid-attr-value', within: '.bx--list-box__wrapper' }
];

async function main() {
	const browser = await chromium.launch();
	const results = [];
	for (const width of WIDTHS) {
		const context = await browser.newContext({ viewport: { width, height: 900 } });
		for (const p of PAGES) {
			const page = await context.newPage();
			await page.goto(BASE_URL + p.path, { waitUntil: 'networkidle' });
			if (p.prepare) await p.prepare(page);
			await page.waitForTimeout(1000);
			await page.addScriptTag({ content: axeSource });
			const violations = await page.evaluate(async (upstream) => {
				const r = await axe.run(document, { resultTypes: ['violations'] });
				return r.violations.map((v) => {
					const rules = upstream.filter((u) => u.id === v.id);
					const isUpstream =
						rules.length > 0 &&
						v.nodes.every((n) => {
							const el = document.querySelector(n.target.join(' '));
							return el && rules.some((u) => el.closest(u.within));
						});
					return {
						id: v.id,
						impact: v.impact,
						help: v.help,
						upstream: isUpstream,
						nodes: v.nodes.length,
						targets: v.nodes.slice(0, 3).map((n) => n.target.join(' '))
					};
				});
			}, UPSTREAM);
			results.push({ page: p.name, width, violations });
			const byImpact = Object.fromEntries(
				IMPACTS.map((i) => [i, violations.filter((v) => v.impact === i).length])
			);
			console.log(
				`${p.name.padEnd(10)} ${String(width).padStart(4)} ` +
					IMPACTS.map((i) => `${i}=${byImpact[i]}`).join(' ')
			);
			for (const v of violations) {
				console.log(
					`    [${v.impact}] ${v.id} (${v.nodes} nodes)${v.upstream ? ' [upstream]' : ''}: ${v.help}`
				);
			}
			await page.close();
		}
		await context.close();
	}
	await browser.close();
	if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(results, null, 2));
	if (process.env.CHECK === '1') {
		const bad = results.flatMap((r) =>
			r.violations
				.filter((v) => !v.upstream && (v.impact === 'critical' || v.impact === 'serious'))
				.map((v) => `${r.page}@${r.width}: ${v.id}`)
		);
		console.log(`a11y check: ${bad.length} serious/critical violation(s)`);
		if (bad.length) {
			for (const b of bad) console.error(`FAIL ${b}`);
			process.exit(1);
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
