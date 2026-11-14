/**
 * Noren on NEAR film v8 (Claude, Nov 14): Nick's order. One live run on NEAR testnet with the build-gated QA signer.
 *   landing (comparison) -> Noren Merchant (sign in, store, payout, link, API keys, connect Aubelle)
 *   -> Noren app (home, test funds, lock test BTC twice: the limit appears and grows)
 *   -> Aubelle as a buyer, four times: product -> bag -> Pay with Noren pop-up -> Pay in 3 / Pay later / test BTC / gasless USDC
 *   -> repay, withdraw, Aubelle's Noren Merchant (payments, payouts) -> landing end.
 * Every signed transaction shows the test wallet's Approve sheet on camera and is then opened on the explorer.
 * Camera: Chrome DevTools screencast (1440x810 CSS at 4/3 -> 1920x1080 JPEG), as in v7. Hands: visible pointer.
 * Needs: cd packages/web && VITE_QA_SIGNER=1 npx vite --mode qa --host 127.0.0.1 --port 5330 --strictPort
 * Usage: node film/near-v8/record.mjs <work dir> [--from=<step>]
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, utimesSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { withChromeLock, LOCK } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { loadDeployment, loadCreds, accountFor, provider, view, signPrice, fetchBtcSpot } from '/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near/scripts/near-lib.ts';

const repo = '/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near', APP = 'http://127.0.0.1:5330', FAST = 'https://test.rpc.fastnear.com';
// FastNEAR rate-limits this machine (many agents share it); NEAR_RPC sends the run's RPC traffic, page and Node, to another public testnet endpoint.
const RPC = process.env.NEAR_RPC ?? FAST;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS' };
const reroute = async ctx => { if (RPC !== FAST) await ctx.route(FAST + '/**', async r => {
  const q = r.request(); if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
  try { let status = 502, body = ''; for (const u of [RPC, FAST, 'https://archival-rpc.testnet.fastnear.com']) { const res = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: q.postData() }); status = res.status; body = await res.text(); if (status < 400 && !/"code":\s*-429\b/.test(body) && !/Request Timeout|Too Many Requests/i.test(body)) break; } await r.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body }); }
  catch { await r.abort('failed').catch(() => {}); }
}); };
const require = createRequire(join(repo, 'package.json')), { chromium } = require('playwright-core'), { actions } = require('near-api-js');
const d = loadDeployment(), account = d.accounts.alice, credit = d.accounts.credit, usdc = d.accounts.tusdc, shopAcct = d.accounts.shop, R0 = d.root, relayer = 'relayer.' + R0;
const WBTC = 'wbtc.fakes.testnet';
const WORK = process.argv[2]; if (!WORK || WORK.startsWith('--')) throw Error('Pass the film work directory.');
const FROM = process.argv.find(a => a.startsWith('--from='))?.slice(7);
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), FR = join(WORK, 'frames-' + stamp); mkdirSync(FR, { recursive: true });
const STATE = join(WORK, 'state'); mkdirSync(STATE, { recursive: true }); chmodSync(STATE, 0o700);
const file = join(repo, 'deployments/near8-film-' + stamp + '.json');
const check = (ok, m) => { if (!ok) throw Error(m); }, sleep = ms => new Promise(r => setTimeout(r, ms));
let R, signer, stage = 'preflight', app, exp, shopper, ctxA, ctxB; const tasks = new Set();
const J = v => JSON.stringify(v, (k, x) => typeof x === 'bigint' ? String(x) : x, 2) + '\n';
const save = () => { if (R) { writeFileSync(file, J(R)); writeFileSync(join(WORK, 'live.json'), J(R)); } };
const freePct = () => Number(/free percentage: (\d+)/.exec(execFileSync('memory_pressure', { encoding: 'utf8' }))?.[1] ?? 0);
async function gate() { while (freePct() < 25) { console.log('Waiting for free memory.'); await sleep(20000); } }
const retry = async (fn, n = 5) => { for (let k = 0; ; k++) { try { return await fn(); } catch (e) { if (k >= n) throw e; await new Promise(r => setTimeout(r, 1500 * (k + 1))); } } };
const ft = async (t, id) => BigInt(await view(t, 'ft_balance_of', { account_id: id }));
const nearOf = async id => BigInt((await provider.viewAccount({ accountId: id })).amount);
const riyaId = 'riya.' + R0;
const snap = async () => ({ position: await view(credit, 'position', { borrower: account }), wbtc: await ft(WBTC, account), usdc: await ft(usdc, account), shop: await ft(usdc, shopAcct), near: await nearOf(account), riyaUsdc: await ft(usdc, riyaId), riyaNear: await nearOf(riyaId), relayerNear: await nearOf(relayer) });

// ---- budget guards for browser-signed transactions (testnet only)
async function reserveAlice(q) {
  check(q.receiverId.endsWith('.testnet'), 'Testnet receiver required.');
  const gp = BigInt((await retry(() => provider.viewGasPrice())).gas_price), cost = BigInt(q.gas) * gp + BigInt(q.deposit);
  const a = await retry(() => provider.viewAccount({ accountId: account })); check(BigInt(a.amount) - BigInt(a.storage_usage) * 10n ** 19n > cost * 11n + 3n * 10n ** 21n, 'Low NEAR for prepaid gas.');
  const used = BigInt(R.reservedYocto) + cost; check(used <= 400n * 10n ** 21n, 'Film reservation cap reached.'); R.reservedYocto = String(used); R.attempts.push({ stage, ...q }); save();
}
async function reserveRiya(q) {
  check(q.gasless === true && q.receiverId === usdc, 'Riya signs gasless test-USDC payments only.');
  check(await retry(() => nearOf(relayer)) > 20n * 10n ** 21n, 'Relayer needs at least 0.02 NEAR.'); R.attempts.push({ stage, ...q }); save();
}

// ---- camera
const cams = new Map();
async function camera(ctx, p, name) {
  const dir = join(FR, name); mkdirSync(dir, { recursive: true }); const cdp = await ctx.newCDPSession(p); const cam = { name, dir, list: [], cdp }; cams.set(p, cam);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { const f = String(cam.list.length).padStart(6, '0') + '.jpg'; writeFileSync(join(dir, f), Buffer.from(data, 'base64')); cam.list.push([metadata.timestamp, f]); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 86, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
}
const flushIndex = () => { for (const c of cams.values()) writeFileSync(join(c.dir, 'index.json'), JSON.stringify(c.list)); };

// ---- hands. One pointer: the top page hides its own while the mouse is over the Noren pop-up's frame, which draws its own.
const CURSOR = `(()=>{const top=window===window.top;const mk=()=>{if(document.getElementById('film-cursor')||!document.body)return;const n=document.createElement('div');n.id='film-cursor';n.style.cssText='position:fixed;left:-40px;top:-40px;width:26px;height:26px;pointer-events:none;z-index:2147483647;transition:transform .12s';n.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5l6.8 18.2 2.5-7.3 7.2-2.6z" fill="#fff" stroke="#101a3c" stroke-width="1.6" stroke-linejoin="round"/></svg>';document.body.append(n);addEventListener('mousemove',e=>{n.style.display='';n.style.left=e.clientX-4+'px';n.style.top=e.clientY-3+'px'},true);addEventListener('mousedown',()=>n.style.transform='scale(.82)',true);addEventListener('mouseup',()=>n.style.transform='',true);let px=-99,py=-99;addEventListener('mousemove',e=>{px=e.clientX;py=e.clientY},true);if(top){const tick=()=>{let over=false;for(const f of document.querySelectorAll('iframe')){const r=f.getBoundingClientRect();if(px>=r.left&&px<=r.right&&py>=r.top&&py<=r.bottom)over=true}if(over)n.style.display='none';requestAnimationFrame(tick)};requestAnimationFrame(tick)}else document.addEventListener('mouseleave',()=>{n.style.display='none'})};if(document.readyState==='loading')addEventListener('DOMContentLoaded',mk);else mk();new MutationObserver(mk).observe(document,{childList:true,subtree:true})})()`;
const REDACT = () => { const add = () => { if (!document.head || document.getElementById('film-redaction')) return; const s = document.createElement('style'); s.id = 'film-redaction'; s.textContent = '.ob-keys dd:nth-of-type(2),.sd-secret{position:relative!important;color:transparent!important;background:#101a3c!important;overflow:hidden!important}.ob-keys dd:nth-of-type(2)>*,.sd-secret>*{visibility:hidden!important}.ob-keys dd:nth-of-type(2)::after,.sd-secret::after{content:"secret key · redacted";position:absolute;inset:0;display:grid;place-items:center;color:#efe8db;font:500 14px monospace}'; document.head.append(s); }; new MutationObserver(add).observe(document, { childList: true, subtree: true }); add(); };
const mouse = new Map();
function ev(p, type, extra = {}) { R.events.push({ page: cams.get(p)?.name, t: Date.now() / 1000, type, stage, ...extra }); save(); }
async function moveTo(p, x, y, steps = 20) { const m = mouse.get(p) ?? { x: 1200, y: 700 }; for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; await p.mouse.move(m.x + (x - m.x) * e, m.y + (y - m.y) * e); await sleep(16); } mouse.set(p, { x, y }); ev(p, 'move', { x, y }); }
async function point(p, loc, opt = {}) {
  loc = loc.first(); await loc.waitFor({ state: 'visible' }); let b = await loc.boundingBox(); check(b, 'Missing filmed control.');
  const lo = opt.top ?? 80, hi = opt.bottom ?? 790;
  if (b.y < lo || b.y + Math.min(b.height, 100) > hi) { await loc.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(900); b = await loc.boundingBox(); }
  await moveTo(p, b.x + Math.min(b.width / 2, opt.maxX ?? 160), b.y + Math.min(b.height / 2, 40));
}
async function click(p, loc, hold = 280, opt) { await point(p, loc, opt); await sleep(hold); ev(p, 'click'); await p.mouse.down(); await sleep(70); await p.mouse.up(); await sleep(260); }
async function fill(p, loc, value) { await click(p, loc); await loc.first().press('ControlOrMeta+A'); await loc.first().press('Backspace'); ev(p, 'type', { value: value.length > 40 ? '(long)' : value }); await p.keyboard.type(value, { delay: 60 }); await sleep(250); }
async function glide(p, dy, ms = 1600) { const n = Math.max(1, Math.round(ms / 33)); ev(p, 'scroll', { dy }); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy / n); await sleep(33); } }
// A full page load (never a same-document hash change), so each scene starts with a fresh wallet session.
async function open(p, url) { await p.goto('about:blank'); await p.goto(url); }
async function hash(p, h) { await p.evaluate(h => location.hash = h, h); await sleep(800); }
async function take(name, p, fn) { stage = name; R.stage = name; save(); await p.bringToFront(); const start = Date.now() / 1000; R.activeTake = { id: name, page: cams.get(p).name, start }; save(); await fn(); await sleep(900); const end = Date.now() / 1000; R.takes.push({ id: name, page: cams.get(p).name, start, end }); delete R.activeTake; flushIndex(); save(); console.log('take', name, (end - start).toFixed(1) + 's'); }
// Connect the test wallet if the page asks for it; wait while the wallet is still loading (button disabled).
async function connect(p, scope = p) {
  const b = scope.getByRole('button', { name: 'Connect Meteor Wallet', exact: true }); await sleep(900);
  for (let i = 0; i < 40; i++) { if (!await b.count() || !await b.first().isVisible()) return; if (await b.first().isEnabled()) { await click(p, b); await sleep(1200); continue; } await sleep(500); }
  check(false, 'The wallet did not connect.');
}
const pop = p => p.frameLocator('iframe[title="Noren checkout"]');
async function waitAny(p, fn, arg, timeout = 120000) { const t0 = Date.now(); for (;;) { for (const f of p.frames()) { try { if (await f.evaluate(fn, arg)) return; } catch {} } check(Date.now() - t0 < timeout, 'Timed out waiting on the page.'); await sleep(400); } }
async function txStatus(h, sender) { const q = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'film', method: 'tx', params: { tx_hash: h, sender_account_id: sender, wait_until: 'FINAL' } }) }); const j = await q.json(); return { final: j.result?.final_execution_status === 'FINAL', ok: !!j.result && !j.result.status?.Failure && !j.result.receipts_outcome.some(r => r.outcome.status.Failure), signer: j.result?.transaction?.signer_id, inner: j.result?.transaction?.actions?.[0]?.Delegate?.delegate_action?.sender_id } }
async function final(p, name, sender = account) {
  ev(p, 'wait-start', { label: name });
  // The page's own FINAL notice, or the chain saying FINAL for this stage's captured hash (then give the UI a moment).
  const t0 = Date.now();
  for (;;) {
    let shown = false; for (const f of p.frames()) { try { if (await f.evaluate(() => [...document.querySelectorAll('[role="status"],.co-done')].some(x => /final on NEAR testnet/i.test(x.textContent ?? '')))) shown = true; } catch {} }
    if (shown) break;
    const mine = R.transactions.filter(x => x.action === name);
    if (mine.length) { const st = await Promise.all(mine.map(x => txStatus(x.hash, x.sender ?? sender).catch(() => ({})))); if (st.every(x => x.final)) { await sleep(2500); break; } }
    check(Date.now() - t0 < 150000, 'No FINAL for ' + name); await sleep(1500);
  }
  await Promise.all([...tasks]); ev(p, 'wait-end', { label: name });
  const t = R.transactions.filter(x => x.action === name); check(t.length > 0, 'No transaction hash captured for ' + name);
  for (const x of t) Object.assign(x, await txStatus(x.hash, x.sender ?? sender)); save();
  check(t.every(x => x.final && x.ok), 'Transaction not successful FINAL: ' + name);
}
// The test wallet's Approve sheet (inside the pop-up when paying at Aubelle): read it on camera, then Approve.
async function approve(p, scope = p, focus) {
  const sheet = scope.locator('[data-qa-approval]'); try { await sheet.waitFor(); } catch (e) { const why = await scope.locator('[role="alert"],.err,.nk-err').allInnerTexts().catch(() => []); R.errors.push({ stage, type: 'no approval sheet', message: why.join(' | ').slice(0, 300) }); save(); throw e; } await sleep(1200);
  await point(p, focus ? sheet.locator('dd').filter({ hasText: focus }) : sheet.locator('dl'), { top: 0, bottom: 810 }); await sleep(3000);
  await click(p, scope.locator('[data-qa-approve]'), 450, { top: 0, bottom: 810 }); await sleep(400);
}
async function explorer(name, hold = 2600, extra) {
  const t = R.transactions.find(x => x.action === name); check(t, 'No hash for explorer: ' + name);
  for (let k = 0; ; k++) { await exp.goto(`https://nearvalidate.org/txns/${t.hash}?network=testnet`, { waitUntil: 'domcontentloaded', timeout: 60000 }); try { await exp.getByText('Success', { exact: true }).first().waitFor({ timeout: 20000 }); break; } catch (e) { if (k >= 8) throw e; await sleep(8000); } }
  await sleep(1300);
  await take('explorer-' + name, exp, async () => { await point(exp, exp.getByText('Success', { exact: true })); await sleep(hold); if (extra) await extra(); });
  t.explorerShown = true; t.explorerURL = exp.url(); save(); await app.bringToFront();
}
// Signed BTC price (Coinbase spot; the contract checks Noren's relayer signature). Sent from Node, off the pointer.
async function freshBtc(maxAge = 40) {
  const all = await retry(() => view(credit, 'assets')); const a = all.find(x => x.token === WBTC);
  if (a && a.price_fresh && Date.now() - Number(BigInt(a.price_at_ns) / 1000000n) < maxAge * 1000) return;
  const spot = await fetchBtcSpot(), creds = loadCreds(); const { message: _, ...args } = signPrice(creds.relayerKey, credit, WBTC, spot.priceUsd6, spot.timestampNs);
  await reserveAlice({ receiverId: credit, gas: '30000000000000', deposit: '0' });
  const tx = await signer.signAndSendTransaction({ receiverId: credit, actions: [actions.functionCall('post_signed_price', args, 30000000000000n, 0n)], waitUntil: 'FINAL', throwOnFailure: false });
  R.transactions.push({ source: 'Node price relayer', action: 'price-btc-' + stage, hash: tx.transaction.hash, final: true, ok: !tx.status.Failure, priceUsd6: String(spot.priceUsd6) }); save(); check(!tx.status.Failure, 'Price post failed.');
}
function hashCapture(p, sender) {
  p.on('response', r => {
    const u = r.url(); let q; try { q = r.request().postDataJSON(); } catch { return; }
    const relay = u.endsWith('/api/relay') && r.request().method() === 'POST', rpc = (u.startsWith(RPC) || u.startsWith(FAST)) && ['send_tx', 'broadcast_tx_commit', 'broadcast_tx_async'].includes(q?.method);
    if (!relay && !rpc) return; const at = stage;
    const t = (async () => { const j = await r.json(); const h = relay ? j.hash : j.result?.transaction?.hash ?? j.result?.transaction_outcome?.id ?? (typeof j.result === 'string' ? j.result : null); if (h && !R.transactions.some(x => x.hash === h)) { R.transactions.push({ source: relay ? 'Noren gas relayer' : 'browser QA signer', action: at, hash: h, sender: relay ? relayer : sender }); save(); } else if (relay && !h) R.errors.push({ stage: at, type: 'relay', message: j.error }); })().catch(() => { R.errors.push({ stage: at, type: 'hash capture failed' }); save(); });
    tasks.add(t); t.finally(() => tasks.delete(t));
  });
  p.on('console', m => { if (m.type() === 'error') { R.errors.push({ stage, type: 'console', message: m.text().slice(0, 240) }); save(); } });
  p.on('pageerror', e => { R.errors.push({ stage, type: 'page exception', message: String(e.message).slice(0, 200) }); save(); });
}

// ---- Aubelle as a buyer: a dress -> size -> Add to bag -> bag drawer -> View bag -> Pay with Noren -> the pop-up
async function buy(p, slug, size, { fromHome = false } = {}) {
  if (fromHome) { await click(p, p.locator(`a.card[href="#/p/${slug}"]`)); }
  else { await click(p, p.getByRole('link', { name: 'Dresses', exact: true })); await sleep(1500); await glide(p, 420, 1100); await sleep(500); await click(p, p.locator(`a.card[href="#/p/${slug}"]`)); }
  await p.locator('.pdp').waitFor(); await sleep(1600);
  await click(p, p.getByRole('button', { name: size, exact: true })); await sleep(400);
  await click(p, p.getByRole('button', { name: /Add to bag/ })); await sleep(1400);
  await click(p, p.getByRole('link', { name: 'View bag', exact: true })); await p.locator('.bag-page').waitFor(); await sleep(1600);
  await point(p, p.locator('.summary .sum-row.total')); await sleep(1100);
  await click(p, p.locator('.summary').getByRole('button', { name: /Pay with/ }));
  await p.locator('iframe[title="Noren checkout"]').waitFor(); const f = pop(p); await f.locator('.co-amt').waitFor(); await sleep(1800);
  const src = await p.locator('iframe[title="Noren checkout"]').getAttribute('src'); R.invoices[stage] = src; save();
  return f;
}
async function backToShop(p, f, label = 'Return to Aubelle') { await click(p, f.getByRole('link', { name: label, exact: true })); await p.locator('.order').waitFor(); await sleep(2600); }

const STEPS = [
  ['landing', async () => {
    await open(app, APP + '/#/'); await app.locator('.lx-hero').waitFor(); await sleep(1800);
    await take('landing', app, async () => {
      await moveTo(app, 980, 560, 30); await sleep(2400);
      for (let i = 0; i < 12; i++) { const top = await app.locator('#compare').evaluate(e => e.getBoundingClientRect().top); if (top < 120) break; await glide(app, Math.min(760, top - 70), 1300); await sleep(500); }
      await sleep(2600); await point(app, app.locator('#compare .nx-vs-t thead th.me')); await sleep(2000);
      await glide(app, 330, 1200); await sleep(1200);
      for (const r of [0, 1, 3, 4]) { await point(app, app.locator('#compare tbody tr').nth(r).locator('td.me')); await sleep(1700); }
      await glide(app, 260, 900); await sleep(2400);
    });
  }],
  ['merchant', async () => {
    await open(app, APP + '/#/dashboard/onboard'); await sleep(1400);
    await take('merchant', app, async () => {
      await sleep(1200); await click(app, app.getByRole('button', { name: 'Meteor Wallet', exact: false })); await app.getByRole('heading', { name: "What's your business called?" }).waitFor(); await sleep(900);
      await fill(app, app.getByPlaceholder('Chai Point, Bandra'), 'Aubelle'); await sleep(500); await click(app, app.getByRole('button', { name: 'Continue', exact: false })); await sleep(1200);
      await click(app, app.getByRole('radio', { name: /another address/ })); await fill(app, app.getByPlaceholder('my-shop.testnet'), shopAcct); await sleep(900);
      await click(app, app.getByRole('button', { name: 'Create store', exact: false }));
      await app.getByRole('heading', { name: 'Create your first payment link' }).waitFor(); await sleep(1200);
      await fill(app, app.getByLabel('Amount (USDC)', { exact: true }), '12'); await fill(app, app.getByPlaceholder('Masala chai, large'), 'Silk scrunchie set');
      await click(app, app.getByRole('button', { name: 'Create link', exact: false })); await app.locator('.ob-url').waitFor(); R.firstLink = await app.locator('.ob-url').innerText(); save(); await sleep(2200);
      await click(app, app.getByRole('button', { name: 'Continue', exact: false })); await app.getByRole('heading', { name: 'Your API keys' }).waitFor(); await sleep(3200);
      await click(app, app.getByRole('button', { name: 'Go to your dashboard', exact: false })); await sleep(2600);
      await hash(app, '#/dashboard/settings'); await sleep(1000);
      await click(app, app.getByRole('button', { name: 'Connect Aubelle demo shop', exact: true })); await sleep(2200);
    });
    const cfg = await (await fetch(APP + '/api/shop/config')).json(); R.shopMerchant = cfg.merchant; check(cfg.ready, 'Shop not connected.'); save();
    await ctxA.storageState({ path: join(STATE, 'alice.json') });
  }],
  ['app', async () => {
    await open(app, APP + '/#/app'); await connect(app); await app.locator('.nk-wallet').waitFor(); await sleep(2000);
    await take('app-home', app, async () => { await point(app, app.locator('.nk-wallet-total')); await sleep(2600); await glide(app, 520, 1400); await sleep(2600); await glide(app, -520, 1000); await sleep(800); });
    // How a customer gets funds on testnet: the app's faucet button mints 200 test USDC to her wallet.
    await take('faucet', app, async () => { await click(app, app.locator('.nk-chip')); await sleep(1000); await click(app, app.getByRole('button', { name: 'Get 200 test USDC', exact: true })); await approve(app); await final(app, 'faucet'); await sleep(1600); const c = app.getByRole('button', { name: 'Close', exact: true }); if (await c.count() && await c.first().isVisible()) await click(app, c); await sleep(1400); await point(app, app.locator('.nk-wallet-total')); await sleep(2000); });
    await explorer('faucet', 2200);
  }],
  ...['deposit-1', 'deposit-2'].map(n => [n, async () => {
    await freshBtc(60); await open(app, APP + '/#/app/earn'); await connect(app); await sleep(1500);
    await take(n, app, async () => { await point(app, app.locator('.nk-hero')); await sleep(1200); await app.locator('#near-collateral').selectOption(WBTC); await sleep(500); await fill(app, app.locator('#near-token-amount'), '0.0035'); await sleep(600); await click(app, app.getByRole('button', { name: 'Deposit collateral', exact: true })); await approve(app); await final(app, n); await sleep(2200); await point(app, app.locator('.nk-hero')); await sleep(2800); });
    await explorer(n, n === 'deposit-1' ? 2600 : 1600);
  }]),
  ['credit-tab', async () => {
    await freshBtc(60); await open(app, APP + '/#/app/credit'); await connect(app); await sleep(1500);
    await take('credit-tab', app, async () => { await sleep(1200); await point(app, app.getByText('Your position', { exact: true })); await sleep(2400); await glide(app, 520, 1300); await sleep(2400); await glide(app, -520, 900); await sleep(600); });
  }],
  ['buy-in3', async () => {
    await app.goto(APP + '/shop/'); await sleep(2200);
    await take('buy-in3', app, async () => {
      await moveTo(app, 900, 520, 24); await sleep(2000);
      const f = await buy(app, 'rosalie-knit', 'S');
      // the four ways, read on camera
      await point(app, f.getByRole('tab', { name: /^Pay with stocks/ })); await sleep(1500);
      await point(app, f.locator('.co-pay .kv')); await sleep(2200);
      await click(app, f.getByRole('tab', { name: /^Pay with USDC/ })); await sleep(1500);
      await click(app, f.getByRole('tab', { name: /^Pay later/ })); await sleep(1800);
      await click(app, f.getByRole('tab', { name: /^Pay in 3/ })); await sleep(1600); await connect(app, f);
      await point(app, f.locator('.co-pay p.faint').filter({ hasText: /credit line/ })); await sleep(2200);
      await click(app, f.getByRole('button', { name: 'Create three-draw schedule', exact: true })); await approve(app, f); await final(app, 'buy-in3');
      await f.getByText('Pay-in-3 schedule on NEAR', { exact: true }).waitFor(); await sleep(1600);
      stage = 'draw-1'; await freshBtc(50); await point(app, f.locator('.co-fund')); await sleep(1500);
      await click(app, f.getByRole('button', { name: 'Draw part 1 now', exact: true })); await approve(app, f); await final(app, 'draw-1');
      await f.getByRole('button', { name: /Part 1 · paid/ }).waitFor({ timeout: 30000 }).catch(() => {}); await sleep(2200);
      await point(app, f.locator('.co-fund')); await sleep(1800);
      await backToShop(app, f, 'View shop order status');
    });
    await explorer('buy-in3', 2000); await explorer('draw-1', 2200);
  }],
  ['buy-later', async () => {
    await app.goto(APP + '/shop/'); await app.evaluate(() => localStorage.removeItem('aubelle.bag.v1')); await app.reload(); await sleep(2000);
    await take('buy-later', app, async () => {
      await moveTo(app, 900, 420, 20); await sleep(1200);
      const f = await buy(app, 'amelie-gingham', 'S');
      await click(app, f.getByRole('tab', { name: /^Pay later/ })); await sleep(1400); await connect(app, f); await freshBtc(50);
      await point(app, f.locator('.co-pay p.faint').filter({ hasText: /credit line/ })); await sleep(2000);
      await click(app, f.getByRole('button', { name: /^Pay .* test USDC on credit$/ })); await approve(app, f); await final(app, 'buy-later');
      await f.getByRole('heading', { name: 'Paid with credit' }).waitFor(); await sleep(2400); await point(app, f.locator('.co-done .kv')); await sleep(2000);
      await backToShop(app, f);
    });
    await explorer('buy-later', 3200, async () => { await point(exp, exp.getByText('From', { exact: true })); await sleep(1800); await point(exp, exp.getByText('To', { exact: true })); await sleep(1800); });
  }],
  ['buy-btc', async () => {
    await app.goto(APP + '/shop/'); await app.evaluate(() => localStorage.removeItem('aubelle.bag.v1')); await app.reload(); await sleep(2000);
    await take('buy-btc', app, async () => {
      await moveTo(app, 900, 520, 20); await sleep(800);
      const f = await buy(app, 'juliette-puff', 'M');
      await point(app, f.getByRole('radio', { name: /tTSLA/ })); await sleep(1200); await point(app, f.locator('.co-pay .kv dd').first()); await sleep(2600);
      await freshBtc(40); await click(app, f.getByRole('radio', { name: /WBTC/ })); await sleep(1800); await connect(app, f);
      await point(app, f.locator('.co-pay .kv')); await sleep(2600);
      await click(app, f.getByRole('button', { name: /^Sell .* and pay/ })); await approve(app, f); await final(app, 'buy-btc');
      await f.getByRole('heading', { name: /^Paid with test/ }).waitFor(); await sleep(2400); await point(app, f.locator('.co-done .kv')); await sleep(2000);
      await backToShop(app, f);
    });
    await explorer('buy-btc', 2600);
  }],
  ['buy-gasless', async () => {
    // A second shopper, Riya: test USDC and zero NEAR. Her own browser, her own test key.
    const b = ctxB.pages()[0] ?? await ctxB.newPage(); b.setDefaultTimeout(60000); hashCapture(b, riyaId); await camera(ctxB, b, 'riya');
    await b.goto(APP + '/shop/'); await sleep(2200);
    await take('buy-gasless', b, async () => {
      await moveTo(b, 900, 420, 20); await sleep(1200);
      const f = await buy(b, 'amelie-gingham', 'XS');
      await click(b, f.getByRole('tab', { name: /^Pay with USDC/ })); await sleep(1200); await connect(b, f);
      await f.getByText('No NEAR needed for gas.').waitFor(); await sleep(800); await point(b, f.getByText('No NEAR needed for gas.')); await sleep(3000);
      await click(b, f.getByRole('button', { name: /^Pay .* test USDC$/ })); await approve(b, f, 'Relayer pays the gas');
      ev(b, 'wait-start', { label: 'buy-gasless' }); await f.getByRole('heading', { name: 'Paid with test USDC' }).waitFor({ timeout: 120000 }); await Promise.all([...tasks]); ev(b, 'wait-end', { label: 'buy-gasless' });
      const t = R.transactions.find(x => x.action === 'buy-gasless' && x.source === 'Noren gas relayer'); check(t, 'No relayed hash.'); Object.assign(t, await txStatus(t.hash, relayer)); save();
      check(t.final && t.ok && t.signer === relayer && t.inner === riyaId, 'Relayed payment did not verify.');
      await sleep(1500); await point(b, f.locator('.co-done .kv dd').filter({ hasText: 'Paid by Noren' })); await sleep(2600);
      await backToShop(b, f);
    });
    await explorer('buy-gasless', 1800, async () => { await point(exp, exp.getByText('From', { exact: true })); await sleep(1800); await point(exp, exp.getByText('Delegate Action').first()); await sleep(2200); });
  }],
  ['repay', async () => {
    await app.bringToFront(); await open(app, APP + '/#/app/credit'); await connect(app); await sleep(2200);
    await take('repay', app, async () => {
      await point(app, app.getByText('Your position', { exact: true })); await sleep(2200);
      const pos = await view(credit, 'position', { borrower: account }), bal = await ft(usdc, account);
      if (bal < BigInt(pos.debt_usd6) + 2_000_000n) { await click(app, app.locator('.nk-chip')); await sleep(700); stage = 'faucet-2'; await click(app, app.getByRole('button', { name: 'Get 200 test USDC', exact: true })); await approve(app); await final(app, 'faucet-2'); stage = 'repay'; await sleep(800); const c = app.getByRole('button', { name: 'Close', exact: true }); if (await c.count()) await click(app, c); }
      await click(app, app.getByRole('button', { name: 'Repay credit', exact: true })); await approve(app); await final(app, 'repay'); await sleep(2200); await point(app, app.getByText('Your position', { exact: true })); await sleep(2400);
    });
    await explorer('repay', 2400);
    await take('withdraw', app, async () => { await click(app, app.getByRole('tab', { name: 'Earn', exact: true })); await sleep(1200); await app.locator('#near-collateral').selectOption(WBTC); await fill(app, app.locator('#near-token-amount'), '0.007'); await click(app, app.getByRole('button', { name: 'Withdraw collateral', exact: true })); await approve(app); await final(app, 'withdraw'); await sleep(2600); });
  }],
  ['merchant-view', async () => {
    await open(app, APP + '/#/dashboard'); await sleep(2400);
    await take('merchant-view', app, async () => {
      await moveTo(app, 900, 400, 20); await sleep(2600); await glide(app, 420, 1200); await sleep(2200); await glide(app, -420, 900); await sleep(600);
      await click(app, app.locator('a[href="#/dashboard/payments"]').first()); await sleep(3200);
      await click(app, app.locator('.sd-table tbody tr').first()); await sleep(3600);
      await click(app, app.locator('a[href="#/dashboard/balances"]').first()); await sleep(3600); await glide(app, 360, 1100); await sleep(2600);
    });
  }],
  ['landing-end', async () => {
    await open(app, APP + '/#/'); await app.locator('.lx-hero').waitFor(); await sleep(1500);
    await app.evaluate(() => { document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('in')); document.querySelector('.nx-cta').scrollIntoView({ block: 'center' }); }); await sleep(1500);
    await take('landing-end', app, async () => { await moveTo(app, 720, 600, 30); await sleep(5000); });
  }],
];

async function main() {
  check(d.network === 'testnet', 'Testnet only.'); await gate();
  const before = await snap();
  if (!FROM) check(before.position.debt_usd6 === '0' && before.position.collateral.length === 0, 'Demo position is not clean.');
  check(before.wbtc >= (FROM ? 240000n : 980000n), 'alice needs enough test WBTC for the locks and the BTC payment.'); check(before.riyaNear === 0n && before.riyaUsdc >= 148_000_000n, 'Riya must hold 0 NEAR and >= 148 test USDC.');
  const relay = await (await fetch(APP + '/api/relay')).json(); check(relay.ready && relay.relayer === relayer, 'Relayer not ready on the dev server.');
  R = { network: 'testnet', film: 'v8', evidenceFile: file.split('/').at(-1), framesDir: FR, account, shopper: riyaId, startedAt: new Date().toISOString(), from: FROM ?? null, status: 'RUNNING', reservedYocto: '0', stage, takes: [], events: [], attempts: [], transactions: [], errors: [], invoices: {}, before }; save();
  const creds = loadCreds(); signer = accountFor(account, creds.subKey);
  shopper = JSON.parse(readFileSync(join(repo, '.near-credentials/shopper-riya.json'), 'utf8')); check(shopper.accountId === riyaId, 'Unexpected shopper file.');
  await withChromeLock(async () => {
    await gate(); const heart = setInterval(() => { try { utimesSync(LOCK, new Date(), new Date()); } catch {} }, 30000);
    const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
    try {
      const view0 = { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 };
      const resumeState = FROM && existsSync(join(STATE, 'alice.json')) ? join(STATE, 'alice.json') : undefined;
      ctxA = await browser.newContext({ ...view0, storageState: resumeState }); await reroute(ctxA);
      await ctxA.addInitScript(CURSOR); await ctxA.addInitScript(REDACT);
      await ctxA.addInitScript(({ origin, accountId, privateKey }) => { if (location.origin !== origin) return; try { sessionStorage.setItem('noren.qa.owngas', '1'); } catch {} window.__NOREN_QA_SIGNER__ = { accountId, privateKey, rpcUrl: 'https://test.rpc.fastnear.com', approve: true }; }, { origin: APP, accountId: account, privateKey: creds.subKey });
      app = await ctxA.newPage(); app.setDefaultTimeout(60000); await app.exposeFunction('__norenQaAuthorize', reserveAlice); hashCapture(app, account);
      exp = await ctxA.newPage(); exp.setDefaultTimeout(60000);
      ctxB = await browser.newContext(view0); await reroute(ctxB);
      await ctxB.addInitScript(CURSOR);
      await ctxB.addInitScript(({ origin, accountId, privateKey }) => { if (location.origin === origin) window.__NOREN_QA_SIGNER__ = { accountId, privateKey, rpcUrl: 'https://test.rpc.fastnear.com', approve: true }; }, { origin: APP, accountId: riyaId, privateKey: shopper.privateKey });
      shopper.privateKey = '';
      const rb = await ctxB.newPage(); await rb.exposeFunction('__norenQaAuthorize', reserveRiya);
      await camera(ctxA, app, 'app'); await camera(ctxA, exp, 'explorer'); await app.bringToFront();
      let on = !FROM;
      for (const [name, fn] of STEPS) { if (name === FROM) on = true; if (!on) continue; await gate(); await fn(); }
      R.after = await snap();
      R.checks = { positionClean: R.after.position.debt_usd6 === '0' && R.after.position.collateral.length === 0, riyaNearZero: R.after.riyaNear === 0n, allFinal: R.transactions.filter(t => t.source !== 'Node price relayer').every(t => t.final && t.ok) };
      R.status = Object.values(R.checks).every(Boolean) ? (R.errors.length ? 'PASS_WITH_PAGE_ERRORS' : 'PASS') : 'CHECK'; save();
    } finally { flushIndex(); for (const c of cams.values()) await c.cdp.send('Page.stopScreencast').catch(() => {}); await ctxA?.close().catch(() => {}); await ctxB?.close().catch(() => {}); await browser.close(); clearInterval(heart); }
  });
}
try { await main(); } catch (e) { if (R) { R.status = 'STOPPED'; R.failedStage = stage; R.error = e.message; flushIndex(); save(); } console.error('Film stopped at ' + stage + ': ' + e.message + '\n' + e.stack); process.exitCode = 1; }
finally { if (R) { R.finishedAt = new Date().toISOString(); try { R.actualNearSpentYocto = String(BigInt(R.before.near) - await nearOf(account)); } catch {} save(); console.log('Film evidence', R.status, R.transactions.length, 'tx', file); } }
