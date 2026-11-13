/**
 * Noren on NEAR film v6: re-take of the USDC checkout scene, now gasless (NEP-366), live on NEAR testnet.
 * Riya (riya.<root>, 0 NEAR) pastes Aubelle's 12-dollar link in the Noren app, pays in test USDC; Noren's relayer signs
 * and pays the gas. Then the same transaction on the explorer (signer = relayer). Camera and hands as in v5's recorder.
 * Needs the QA dev server: cd packages/web && VITE_QA_SIGNER=1 npx vite --mode qa --host 127.0.0.1 --port 5330
 * Usage: node film/near-v6/record-gasless.mjs <work dir>
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withChromeLock, LOCK } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { loadDeployment, loadCreds, accountFor, provider } from '/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near/scripts/near-lib.ts';

const repo = '/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near', APP = 'http://127.0.0.1:5330';
const require = createRequire(join(repo, 'package.json')), { chromium } = require('playwright-core');
const d = loadDeployment(), R0 = d.root, usdc = d.accounts.tusdc, shop = d.accounts.shop, relayer = 'relayer.' + R0;
const STORE_MERCHANT = '6f0fe517-99db-47d3-9e0a-0528a0347a6e'; // the Aubelle store created on camera in v5 (owner alice)
const shopper = JSON.parse(readFileSync(join(repo, '.near-credentials/shopper-riya.json'), 'utf8')), account = shopper.accountId;
const WORK = process.argv[2]; if (!WORK) throw Error('Pass the film work directory.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), FR = join(WORK, 'frames-gasless-' + stamp); mkdirSync(FR, { recursive: true });
const file = join(repo, 'deployments/gasless-film-' + stamp + '.json');
const check = (ok, m) => { if (!ok) throw Error(m); }, sleep = ms => new Promise(r => setTimeout(r, ms));
let R, stage = 'preflight', app, exp, context; const tasks = new Set();
const save = () => R && writeFileSync(file, JSON.stringify(R, (k, v) => typeof v === 'bigint' ? String(v) : v, 2) + '\n');
const freePct = () => Number(/free percentage: (\d+)/.exec(execFileSync('memory_pressure', { encoding: 'utf8' }))?.[1] ?? 0);
async function gate() { while (freePct() < 25) { console.log('Waiting for free memory.'); await sleep(20000); } }
const ft = async (t, id) => BigInt(await provider.callFunction({ contractId: t, method: 'ft_balance_of', args: { account_id: id } }));
const near = async id => BigInt((await provider.viewAccount({ accountId: id })).amount);
const snap = async () => ({ riyaNear: await near(account), riyaUsdc: await ft(usdc, account), shopUsdc: await ft(usdc, shop), relayerNear: await near(relayer) });

// The page's signer may only ask for gasless reservations; the shopper has no NEAR to pay any other way.
async function reserve(q) {
  check(q.gasless === true && q.receiverId === usdc, 'Film run signs gasless test-USDC payments only.');
  check(await near(relayer) > 20n * 10n ** 21n, 'Relayer needs at least 0.02 NEAR.');
  R.attempts.push({ stage, ...q }); save();
}

// ---- camera and hands (same as the v5 recorder)
const cams = new Map();
async function camera(p, name) {
  const dir = join(FR, name); mkdirSync(dir, { recursive: true }); const cdp = await context.newCDPSession(p); const cam = { name, dir, list: [], cdp }; cams.set(p, cam);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { const f = String(cam.list.length).padStart(6, '0') + '.jpg'; writeFileSync(join(dir, f), Buffer.from(data, 'base64')); cam.list.push([metadata.timestamp, f]); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
}
const flushIndex = () => { for (const c of cams.values()) writeFileSync(join(c.dir, 'index.json'), JSON.stringify(c.list)); };
const CURSOR = `(()=>{const mk=()=>{if(document.getElementById('film-cursor')||!document.body)return;const n=document.createElement('div');n.id='film-cursor';n.style.cssText='position:fixed;left:-40px;top:-40px;width:26px;height:26px;pointer-events:none;z-index:2147483647;transition:transform .12s';n.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5l6.8 18.2 2.5-7.3 7.2-2.6z" fill="#fff" stroke="#101a3c" stroke-width="1.6" stroke-linejoin="round"/></svg>';document.body.append(n);addEventListener('mousemove',e=>{n.style.left=e.clientX-4+'px';n.style.top=e.clientY-3+'px'},true);addEventListener('mousedown',()=>n.style.transform='scale(.82)',true);addEventListener('mouseup',()=>n.style.transform='',true)};if(document.readyState==='loading')addEventListener('DOMContentLoaded',mk);else mk();new MutationObserver(mk).observe(document,{childList:true,subtree:true})})()`;
const mouse = new Map();
function ev(p, type, extra = {}) { R.events.push({ page: cams.get(p)?.name, t: Date.now() / 1000, type, stage, ...extra }); save(); }
async function moveTo(p, x, y, steps = 18) { const m = mouse.get(p) ?? { x: 1200, y: 700 }; for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await p.mouse.move(m.x + (x - m.x) * e, m.y + (y - m.y) * e); await sleep(16); } mouse.set(p, { x, y }); ev(p, 'move', { x, y }); }
async function point(p, loc) {
  loc = loc.first(); await loc.waitFor({ state: 'visible' }); await loc.scrollIntoViewIfNeeded(); let b = await loc.boundingBox(); check(b, 'Missing filmed control.');
  if (b.y < 80 || b.y + Math.min(b.height, 100) > 790) { await loc.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(800); b = await loc.boundingBox(); }
  await moveTo(p, b.x + Math.min(b.width / 2, 120), b.y + Math.min(b.height / 2, 40));
}
async function click(p, loc, hold = 260) { await point(p, loc); await sleep(hold); ev(p, 'click'); await p.mouse.down(); await sleep(70); await p.mouse.up(); await sleep(260); }
async function still(p, name) { const m = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, bad: /\bundefined\b|\bNaN\b/.test(document.body.innerText) })); R.stills.push({ name, ...m }); save(); }
async function take(name, p, fn) { stage = name; save(); await p.bringToFront(); const start = Date.now() / 1000; await fn(); await sleep(900); const end = Date.now() / 1000; await still(p, name); R.takes.push({ id: name, page: cams.get(p).name, start, end }); flushIndex(); save(); console.log('take', name, (end - start).toFixed(1) + 's'); }
async function connect() { const b = app.getByRole('button', { name: 'Connect Meteor Wallet', exact: true }); await sleep(600); if (await b.count() && await b.first().isVisible()) await click(app, b); await sleep(700); }

// A fresh 12-dollar link on the same Aubelle store, created as its owner signs in (NEP-413), off camera.
async function newLink() {
  const H = { 'content-type': 'application/json', origin: APP };
  const c = await (await fetch(APP + '/api/auth/nonce', { headers: H })).json();
  const { signMessage } = await import(join(repo, 'node_modules/near-api-js/lib/nep413/index.js'));
  const creds = loadCreds(), owner = accountFor(d.accounts.alice, creds.subKey);
  const sig = await signMessage({ signerAccount: owner, payload: { message: c.message, recipient: c.recipient, nonce: Buffer.from(c.nonce, 'base64') } });
  const auth = await (await fetch(APP + '/api/auth/near', { method: 'POST', headers: H, body: JSON.stringify({ challengeId: c.challengeId, accountId: sig.accountId, publicKey: sig.publicKey.toString(), signature: Buffer.from(sig.signature).toString('base64') }) })).json();
  check(auth.session, 'Merchant sign-in failed: ' + JSON.stringify(auth));
  const inv = await (await fetch(APP + `/api/merchants/${STORE_MERCHANT}/invoices`, { method: 'POST', headers: { ...H, authorization: 'Bearer ' + auth.session }, body: JSON.stringify({ amount: '12000000', description: 'Silk scrunchie set' }) })).json();
  check(inv.invoice?.invoiceId, 'Invoice failed: ' + JSON.stringify(inv));
  return APP + '/#/pay/' + inv.invoice.invoiceId;
}

async function main() {
  check(d.network === 'testnet', 'Testnet only.'); await gate();
  const relay = await (await fetch(APP + '/api/relay')).json(); check(relay.ready && relay.relayer === relayer, 'Relayer not ready on the dev server.');
  R = { network: 'testnet', evidenceFile: file.split('/').at(-1), framesDir: FR, account, relayer, startedAt: new Date().toISOString(), status: 'RUNNING', stage, takes: [], events: [], stills: [], attempts: [], transactions: [], errors: [], before: await snap() };
  check(R.before.riyaNear === 0n, 'Shopper must hold 0 NEAR.'); R.link = await newLink(); save();
  await withChromeLock(async () => {
    await gate(); const heart = setInterval(() => { try { utimesSync(LOCK, new Date(), new Date()); } catch {} }, 30000);
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
      await context.addInitScript(CURSOR);
      await context.addInitScript(({ origin, accountId, privateKey }) => { if (location.origin === origin) window.__NOREN_QA_SIGNER__ = { accountId, privateKey, rpcUrl: 'https://test.rpc.fastnear.com' }; }, { origin: APP, accountId: account, privateKey: shopper.privateKey });
      shopper.privateKey = '';
      app = await context.newPage(); app.setDefaultTimeout(60000); await app.exposeFunction('__norenQaAuthorize', reserve);
      app.on('pageerror', e => { R.errors.push({ stage, type: 'page exception', message: String(e.message).slice(0, 200) }); save(); });
      app.on('response', r => { if (!r.url().endsWith('/api/relay') || r.request().method() !== 'POST') return; const at = stage, t = (async () => { const j = await r.json(); if (j.hash) { R.transactions.push({ source: 'Noren gas relayer', action: at, hash: j.hash, relayer: j.relayer, sender: j.sender }); save(); } else R.errors.push({ stage: at, type: 'relay', message: j.error }); })().catch(() => {}); tasks.add(t); t.finally(() => tasks.delete(t)); });
      exp = await context.newPage(); exp.setDefaultTimeout(60000);
      await camera(app, 'app'); await camera(exp, 'explorer'); await app.bringToFront();

      await app.goto(APP + '/#/app'); await connect(); await app.locator('.nk-wallet').waitFor(); await sleep(1500);
      await take('pay-gasless', app, async () => {
        await click(app, app.getByRole('tab', { name: 'Pay', exact: true })); await sleep(900);
        await click(app, app.locator('#nk-link')); await app.locator('#nk-link').fill(R.link); ev(app, 'paste'); await sleep(900);
        await click(app, app.getByRole('link', { name: 'Open checkout', exact: true })); await app.locator('.co-amt').waitFor(); await connect();
        await click(app, app.getByRole('tab', { name: /^Pay with USDC/ })); await app.getByText('No NEAR needed for gas.').waitFor(); await sleep(700);
        await point(app, app.getByText('No NEAR needed for gas.')); await sleep(2600);
        await point(app, app.getByText('Paid by Noren', { exact: true })); await sleep(1600);
        await click(app, app.getByRole('button', { name: 'Pay 12.00 test USDC', exact: true }));
        ev(app, 'wait-start', { label: 'pay-gasless' });
        await app.getByRole('heading', { name: 'Paid with test USDC' }).waitFor({ timeout: 120000 }); await Promise.all([...tasks]); ev(app, 'wait-end', { label: 'pay-gasless' });
        await sleep(900); await point(app, app.locator('.co-done .kv dd').filter({ hasText: 'Paid by Noren' })); await sleep(2800);
      });
      const t = R.transactions.find(x => x.action === 'pay-gasless'); check(t, 'No relayed hash captured.');
      const q = await (await fetch('https://test.rpc.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'film', method: 'tx', params: { tx_hash: t.hash, sender_account_id: relayer, wait_until: 'FINAL' } }) })).json();
      const tx = q.result; t.final = tx.final_execution_status === 'FINAL'; t.ok = !tx.status.Failure && !tx.receipts_outcome.some(r => r.outcome.status.Failure);
      t.outerSigner = tx.transaction.signer_id; t.innerSender = tx.transaction.actions[0].Delegate?.delegate_action.sender_id; save();
      check(t.final && t.ok && t.outerSigner === relayer && t.innerSender === account, 'Relayed tx did not verify.');
      await exp.goto(`https://nearvalidate.org/txns/${t.hash}?network=testnet`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await exp.getByText('Success', { exact: true }).first().waitFor({ timeout: 60000 }); await exp.getByText('Delegate Action').first().waitFor({ timeout: 60000 }); await sleep(1200);
      await take('explorer-gasless', exp, async () => {
        await point(exp, exp.getByText('From', { exact: true })); await sleep(1700);
        await point(exp, exp.getByText('Fee', { exact: true })); await sleep(1400);
        await point(exp, exp.getByText('Delegate Action').first()); await sleep(1800);
      });
      t.explorerURL = exp.url();
      R.after = await snap();
      R.checks = { riyaNearStillZero: R.after.riyaNear === 0n, riyaPaid12: R.before.riyaUsdc - R.after.riyaUsdc === 12_000_000n, shopGot12: R.after.shopUsdc - R.before.shopUsdc === 12_000_000n, relayerPaidGas: R.after.relayerNear < R.before.relayerNear };
      R.status = Object.values(R.checks).every(Boolean) && !R.errors.length ? 'PASS' : 'CHECK';
      save();
    } finally { flushIndex(); for (const c of cams.values()) await c.cdp.send('Page.stopScreencast').catch(() => {}); if (context) await context.close(); await browser.close(); clearInterval(heart); }
  });
}
try { await main(); } catch (e) { if (R) { R.status = 'STOPPED'; R.failedStage = stage; R.error = e.message; flushIndex(); save(); } console.error('Film stopped at ' + stage + ': ' + e.message); process.exitCode = 1; }
finally { if (R) { R.finishedAt = new Date().toISOString(); save(); console.log('Film evidence', R.status, JSON.stringify(R.checks ?? {}), file); } }
