// Read-only production UI gate. No wallet, credentials or transaction broadcasts.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
const root = resolve(import.meta.dirname, '..');
const { withChromeLock } = await import(resolve(root, '../../orchestration/chrome-lock.mjs'));
const output = resolve(root, '../../orchestration/shots/noren-near/r3');
async function memoryReady() {
  while (Number(/free percentage: (\d+)%/.exec(execFileSync('memory_pressure', { encoding: 'utf8' }))?.[1] ?? 0) < 30) {
    console.log('Waiting for 30% free memory before Chrome.');
    await new Promise(r => setTimeout(r, 30000));
  }
}
await memoryReady();
mkdirSync(output, { recursive: true });
const port = Array.from({ length: 700 }, (_, i) => 5300 + i).find(p => spawnSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN'], { stdio: 'ignore' }).status === 1);
if (!port) throw Error('No free preview port in 5300-5999.');
let server;
try {
  server = spawn(resolve(root, 'packages/web/node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: resolve(root, 'packages/web'), stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 200)); }
  if (!ready) throw Error('Preview did not start.');
  await withChromeLock(async () => {
    await memoryReady();
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const rows = [];
    try {
      for (const width of [1440, 375]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const errors = [], failed = [];
        page.on('pageerror', () => errors.push('page exception'));
        page.on('requestfailed', r => failed.push(new URL(r.url()).origin));
        await page.route('https://test.rpc.fastnear.com', route => { const request = route.request().postDataJSON(); if (/send|broadcast/i.test(request.method)) throw Error('Read-only gate refuses writes.'); return route.continue(); });
        for (const [name, hash, wait] of [['credit', '#/near/app', '.nc-hero'], ['pay', '#/near/app/pay', '#nc-to'], ['debt-free', '#/near/app/melt', '.nm-date'], ['about', '#/near', '.nl-coin']]) {
          await page.goto(origin + '/' + hash);
          // The projection view can be empty while live data loads; its tab is still present.
          await page.locator(name === 'debt-free' ? '[role="tab"][aria-selected="true"]' : wait).first().waitFor();
          await page.waitForTimeout(1800); await page.evaluate(() => document.fonts.ready);
          const overflow = await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth);
          const text = await page.locator('body').innerText();
          if (errors.length || overflow || /undefined|NaN|\bArc\b|Robinhood|CCTP|CCIP/.test(text)) throw Error(`UI failed at ${name}, ${width}.`);
          const file = `${name}-gate-${width}.png`;
          await page.screenshot({ path: resolve(output, file), fullPage: true });
          rows.push({ name, width, pageErrors: errors.length, failedRequests: [...failed], overflow, screenshot: file });
        }
        await page.close();
      }
      writeFileSync(resolve(output, 'browser-gate.json'), JSON.stringify(rows, null, 2) + '\n');
      console.log(`${rows.length} read-only production browser checks passed; 0 NEAR spent.`);
    } finally { await browser.close(); }
  });
} finally { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } }
