/**
 * Checkout screenshots at 1440 and 375 for the gasless change (before/after), with the build-gated QA signer
 * loaded with the zero-NEAR shopper. Opens a fresh Aubelle order, selects Pay with USDC, connects. Signs nothing.
 * Usage: node film/near-v6/qa-shots.mjs <label>   (QA dev server on http://127.0.0.1:5330)
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
const repo = '/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near', APP = 'http://127.0.0.1:5330';
const require = createRequire(join(repo, 'package.json')), { chromium } = require('playwright-core');
const label = process.argv[2] ?? 'after', out = '/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/noren-near/gasless';
mkdirSync(out, { recursive: true });
const shopper = JSON.parse(readFileSync(join(repo, '.near-credentials/shopper-riya.json'), 'utf8'));
const order = await (await fetch(APP + '/api/shop/checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: APP }, body: JSON.stringify({ lines: [{ slug: 'amelie-gingham', size: 'S', qty: 1 }] }) })).json();
if (!order.checkoutUrl) throw Error('No checkout: ' + JSON.stringify(order));
const url = APP + '/#/pay/' + order.checkoutUrl.split('/').at(-1);
await withChromeLock(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
  try {
    for (const [w, h] of [[1440, 900], [375, 812]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      await ctx.addInitScript(({ origin, accountId, privateKey }) => { if (location.origin === origin) window.__NOREN_QA_SIGNER__ = { accountId, privateKey, rpcUrl: 'https://test.rpc.fastnear.com' }; }, { origin: APP, accountId: shopper.accountId, privateKey: shopper.privateKey });
      const p = await ctx.newPage(); await p.exposeFunction('__norenQaAuthorize', async () => { throw Error('Screenshots sign nothing.'); });
      await p.goto(url); await p.locator('.co-amt').waitFor();
      await p.getByRole('tab', { name: /^Pay with USDC/ }).click();
      const c = p.getByRole('button', { name: 'Connect Meteor Wallet', exact: true }); await c.waitFor(); await c.click();
      await p.getByText(shopper.accountId, { exact: false }).first().waitFor(); await p.waitForTimeout(2500);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await p.screenshot({ path: join(out, `${label}-checkout-${w}.png`), fullPage: true });
      console.log(label, w, 'overflow', overflow);
      await ctx.close();
    }
  } finally { await browser.close(); }
});
