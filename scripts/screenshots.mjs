#!/usr/bin/env node
// Responsive screenshot matrix + layout checks for the dashboard.
//
// Usage (against a running instance, e.g. `node build` or `bun run dev`):
//   BASE_URL=http://127.0.0.1:3000 OUT=shots node scripts/screenshots.mjs
//
// Env:
//   BASE_URL  app origin                         (default http://127.0.0.1:3000)
//   OUT       output directory                   (default ./screenshots)
//   WIDTHS    comma list of viewport widths       (default 375,768,1024,1440,1920)
//   SCHEMES   comma list of prefers-color-scheme  (default dark,light)
//   SCALE     deviceScaleFactor                   (default 1)
//   PAGES     comma list of page names to run     (default all)
//   USER_ID   vestibule user id for the detail page
//   CHANNEL   text typed into the explorer channel picker (default "off-topic")
//   FULL_PAGE "0" to capture only the viewport (default: full page)
//   CHECK     "1" to exit non-zero if any shot has horizontal page overflow,
//             the side nav covering content, or an unclickable channel picker
//
// Requires the `playwright` package (resolved via require(), so a global install
// on NODE_PATH works) with a Chromium build available.
//
// Writes one PNG per page x width x scheme plus `report.json` containing, for
// each shot: horizontal overflow in px, the elements that stick out of the
// viewport, side-nav/content overlap and chart-vs-container widths.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OUT = process.env.OUT ?? 'screenshots';
const WIDTHS = (process.env.WIDTHS ?? '375,768,1024,1440,1920').split(',').map(Number);
const SCHEMES = (process.env.SCHEMES ?? 'dark,light').split(',');
const SCALE = Number(process.env.SCALE ?? 1);
const USER_ID = process.env.USER_ID ?? '00000000-0000-4000-8000-000000000001';
const CHANNEL = process.env.CHANNEL ?? 'off-topic';
const FULL_PAGE = process.env.FULL_PAGE !== '0';

const ALL_PAGES = [
	{ name: 'overview', path: '/' },
	{ name: 'explorer', path: '/explorer', prepare: selectChannel },
	{ name: 'userdata', path: '/userdata' },
	{ name: 'userdetail', path: `/userdata/${USER_ID}` }
];
const PAGES = process.env.PAGES
	? ALL_PAGES.filter((p) => process.env.PAGES.split(',').includes(p.name))
	: ALL_PAGES;

async function selectChannel(page) {
	const input = page.locator('input[role="combobox"]').first();
	// Detect whether something (e.g. the side nav) covers the picker: a real
	// user could not click it. Fall back to the keyboard so the shot still
	// shows a loaded channel.
	let obscured = false;
	try {
		await input.click({ trial: true, timeout: 1500 });
	} catch {
		obscured = true;
	}
	if (obscured) await input.focus();
	else await input.click();
	await input.fill(CHANNEL);
	const item = page.locator('[role="option"]').first();
	await item.waitFor({ state: 'attached', timeout: 5000 });
	const responded = page.waitForResponse((r) => r.url().includes('/api/messages'), {
		timeout: 10000
	});
	if (obscured) {
		await input.press('ArrowDown');
		await input.press('Enter');
	} else {
		await item.click();
	}
	await responded;
	await page.locator('[data-mid]').first().waitFor({ timeout: 10000 });
	// Move the pointer away so no hover state ends up in the shot.
	await page.mouse.move(0, 0);
	return { pickerObscured: obscured };
}

/** Runs in the page: collects the layout metrics. */
function measure() {
	const vw = document.documentElement.clientWidth;
	const se = document.scrollingElement;
	const describe = (el) => {
		let s = el.tagName.toLowerCase();
		if (el.id) s += `#${el.id}`;
		const cls = [...el.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 3);
		if (cls.length) s += '.' + cls.join('.');
		return s;
	};
	// Elements that start the overflow: they stick out but their parent does not.
	const offenders = [];
	for (const el of document.body.querySelectorAll('*')) {
		const r = el.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) continue;
		if (r.right <= vw + 1) continue;
		const pr = el.parentElement?.getBoundingClientRect();
		if (pr && pr.right > vw + 1 && el.parentElement !== document.body) continue;
		offenders.push({ el: describe(el), right: Math.round(r.right), width: Math.round(r.width) });
	}
	// Long unbroken text overflows its box without the element itself growing,
	// so check text nodes too.
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	while (walker.nextNode()) {
		const t = walker.currentNode;
		if (!t.textContent.trim()) continue;
		range.selectNodeContents(t);
		const r = range.getBoundingClientRect();
		if (r.width === 0 || r.right <= vw + 1) continue;
		const host = t.parentElement;
		if (host && host.getBoundingClientRect().right > vw + 1) continue;
		offenders.push({
			el: `text in ${host ? describe(host) : '?'}: "${t.textContent.trim().slice(0, 40)}"`,
			right: Math.round(r.right),
			width: Math.round(r.width)
		});
	}
	const visible = (el) => {
		if (!el) return false;
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.right > 0;
	};
	const nav = document.querySelector('nav, .bx--side-nav');
	const navEl = nav?.closest('.bx--side-nav') ?? nav;
	const main = document.querySelector('main');
	let navOverlapPx = 0;
	let navVisible = false;
	if (navEl && main && visible(navEl)) {
		navVisible = true;
		const n = navEl.getBoundingClientRect();
		const m = main.getBoundingClientRect();
		// Content box of <main>: what actually holds text.
		const pl = parseFloat(getComputedStyle(main).paddingLeft);
		navOverlapPx = Math.max(0, Math.round(n.right - (m.left + pl)));
	}
	const charts = [...document.querySelectorAll('.cds--chart-holder')].map((c) => {
		const tile = c.closest('.bx--tile') ?? c.parentElement;
		const tr = tile.getBoundingClientRect();
		const svg = c.querySelector('svg.layout-svg-wrapper');
		const sr = svg?.getBoundingClientRect();
		return {
			chart: Math.round(c.getBoundingClientRect().width),
			svg: sr ? Math.round(sr.width) : null,
			container: Math.round(tr.width),
			overflowsContainer: sr ? sr.right > tr.right + 1 : false
		};
	});
	return {
		viewport: vw,
		scrollWidth: se.scrollWidth,
		clientWidth: se.clientWidth,
		overflowPx: se.scrollWidth - se.clientWidth,
		offenders: offenders.slice(0, 15),
		navVisible,
		navOverlapPx,
		charts,
		hasToggle: !!document.querySelector('.bx--header__menu-toggle, [aria-label*="menu" i]')
	};
}

async function main() {
	mkdirSync(OUT, { recursive: true });
	const browser = await chromium.launch();
	const report = [];
	for (const scheme of SCHEMES) {
		for (const width of WIDTHS) {
			const context = await browser.newContext({
				viewport: { width, height: 900 },
				deviceScaleFactor: SCALE,
				colorScheme: scheme
			});
			for (const p of PAGES) {
				const page = await context.newPage();
				await page.goto(BASE_URL + p.path, { waitUntil: 'networkidle' });
				const extra = p.prepare ? await p.prepare(page) : {};
				// Charts render client-side and animate in.
				await page.waitForTimeout(1200);
				const m = await page.evaluate(measure);
				const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
				const file = `${p.name}-${width}-${scheme}.png`;
				await page.screenshot({ path: join(OUT, file), fullPage: FULL_PAGE });
				report.push({ page: p.name, width, scheme, file, bodyBg, ...extra, ...m });
				console.log(
					`${p.name.padEnd(10)} ${String(width).padStart(4)} ${scheme.padEnd(5)} overflow=${m.overflowPx}px nav=${m.navVisible ? 'visible' : 'hidden'} overlap=${m.navOverlapPx}px charts=${m.charts.map((c) => `${c.svg}/${c.container}`).join(',')}${extra.pickerObscured ? ' PICKER-OBSCURED' : ''}`
				);
				// Small screens: also capture the navigation opened via the header's
				// hamburger button (if there is one).
				if (p.name === 'overview' && width < 1056) {
					const toggle = page.locator('.bx--header__menu-toggle');
					if (await toggle.count()) {
						await toggle.click();
						await page.waitForTimeout(400);
						const navAfterToggle = await page.evaluate(() => {
							const n = document.querySelector('.bx--side-nav');
							const r = n.getBoundingClientRect();
							return { width: Math.round(r.width), right: Math.round(r.right) };
						});
						const menuFile = `${p.name}-${width}-${scheme}-menu.png`;
						await page.screenshot({ path: join(OUT, menuFile) });
						report.push({ page: `${p.name}+menu`, width, scheme, file: menuFile, navAfterToggle });
						console.log(`${p.name}+menu ${width} ${scheme} nav=${JSON.stringify(navAfterToggle)}`);
					}
				}
				await page.close();
			}
			await context.close();
		}
	}
	await browser.close();
	writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

	if (process.env.CHECK === '1') {
		const failures = report.filter(
			(r) => r.overflowPx > 0 || r.navOverlapPx > 0 || r.pickerObscured
		);
		for (const f of failures) {
			console.error(
				`FAIL ${f.page} ${f.width} ${f.scheme}: overflow=${f.overflowPx}px navOverlap=${f.navOverlapPx}px${f.pickerObscured ? ' picker obscured' : ''}`
			);
		}
		console.log(`layout check: ${report.length - failures.length}/${report.length} shots passed`);
		if (failures.length) process.exit(1);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
