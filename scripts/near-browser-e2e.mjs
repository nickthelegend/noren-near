import { equityPrices, freshSignedEquity } from './equity-source.ts';
import { EQUITY_BUDGET_GROUP, assertEquityBudget } from './equity-budget.mjs';
// Real browser signing. Credentials enter only an ephemeral localhost page via addInitScript.
// No trace, HAR, video, persistent browser profile, credential log or credential copy is made.
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, openSync, closeSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import { actions } from 'near-api-js';
import { stockAccount } from '../packages/sdk/src/stocks.ts';
import { accountFor, loadDeployment, view, provider, fetchBtcSpot, signPrice } from './near-lib.ts';
const root = resolve(import.meta.dirname, '..');
const orchestration = resolve(root, '../../orchestration');
const { withChromeLock } = await import(resolve(orchestration, 'chrome-lock.mjs'));
const screenshots = join(orchestration, process.argv.includes('--stocks') ? 'shots/noren-near/yahoo/qa-signer' : 'shots/noren-near/r3/qa-signer');
const qaDir = join(root, '.near-build/qa-web');
const RPC = 'https://test.rpc.fastnear.com', CAP = process.argv.includes('--stocks') ? 500_000_000_000_000_000_000_000n : 300_000_000_000_000_000_000_000n;
const args = process.argv.slice(2), keyIndex = args.indexOf('--key-file');
const keyPath = resolve(root, keyIndex < 0 ? '.near-credentials/testnet.json' : args[keyIndex + 1] ?? '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let captureDir = screenshots;
let stockOracleError = '', stockQuotes = [], stockToken = '', stockFetchedAt = 0;
const stockMode = process.argv.includes('--stocks');
const widthArg=process.argv.find(x=>x.startsWith('--width='));const widths=widthArg?[Number(widthArg.slice(8))]:[1440,375];checkWidths();function checkWidths(){if(!widths.every(w=>[1440,375].includes(w)))throw Error('Use --width=1440 or --width=375.');}
let stage = 'preflight', server, browser, ledger, run, reserved = 0n, initialNear, account, secret;
const output = join(root, `deployments/qa-browser-${stockMode?'equities-':''}${stockMode?new Date().toISOString().replace(/[:.]/g,'-'):new Date().toISOString().slice(0, 10)}.json`);
const save = () => { if (ledger) writeFileSync(output, JSON.stringify(ledger, null, 2) + '\n'); };
const check = (ok, label) => { if (!ok) throw Error(label); };
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'qa-budget', method, params }), signal: AbortSignal.timeout(15000) });
  const j = await r.json(); check(r.ok && !j.error, 'Testnet RPC unavailable.'); return j.result;
}
async function reserve(request) {
  check(request.receiverId.endsWith('.testnet'), 'Non-testnet receiver refused.');
  const gasPrice = BigInt((await rpc('gas_price', [null])).gas_price);
  const cost = BigInt(request.gas) * gasPrice * 2n + BigInt(request.deposit);
  if (stockMode) assertEquityBudget(cost);
  check(reserved + cost <= CAP, 'QA budget exhausted; no new transaction authorized.');
  reserved += cost; run.reservedYocto = (BigInt(run.reservedYocto) + cost).toString();
  run.attempts.push({ stage, ...request, maximumCostYocto: cost.toString() }); save();
}
async function stopServer() {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  server = undefined;
}
async function serve(dir, port) {
  await stopServer();
  server = spawn(join(root, 'packages/web/node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--outDir', dir], { cwd: join(root, 'packages/web'), stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw Error('Preview failed to start.');
    try { if ((await fetch(origin)).ok) return origin; } catch {}
    await sleep(200);
  }
  throw Error('Preview startup timeout.');
}
async function resources() {
  const memoryFree = () => Number(/free percentage: (\d+)%/.exec(execFileSync('memory_pressure', { encoding: 'utf8' }))?.[1] ?? 0);
  while (memoryFree() < 30) { console.log('Waiting for 30% free memory.'); await sleep(30000); }
  const disk = execFileSync('df', ['-k', '/System/Volumes/Data'], { encoding: 'utf8' }).trim().split('\n').at(-1).trim().split(/\s+/);
  check(Number(disk[3]) >= 5 * 1024 * 1024, 'Less than 5 GB free; stopped before build/browser.');
}
async function build(label, command, env) {
  await resources();
  const log = openSync(join(screenshots, `${label}-build.log`), 'w');
  try { const child = spawn('pnpm', command, { cwd: root, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1536', ...env }, stdio: ['ignore', log, log] }); const [code] = await once(child, 'exit'); check(code === 0, `${label} build failed.`); }
  finally { closeSync(log); }
}
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]); }
function audit(dir, expectQa) {
  const markers = ['qa-signer', '__NOREN_QA_SIGNER__', '__norenQaAuthorize'];
  const all = files(dir), found = Object.fromEntries(markers.map(marker => [marker, all.some(f => f.includes(marker) || readFileSync(f).includes(marker))]));
  check(expectQa ? found['qa-signer'] : Object.values(found).every(v => !v), 'QA module build isolation failed.');
  const chainMatches = Object.fromEntries(['Arc', 'Robinhood', 'CCTP', 'arc.io'].map(s => [s, all.some(f => /\.(?:js|css|html)$/.test(f) && readFileSync(f).includes(s))]));
  check(Object.values(chainMatches).every(v => !v), 'Another-chain content in the build.');
  return { files: all.length, markers: found, chainMatches };
}
async function main() {
  for (let i = 0; i < args.length; i++) { if (args[i] === '--key-file') { check(args[i + 1] && !args[i + 1].startsWith('--'), 'Supply a credential file path.'); i++; } else check(['--skip-build','--stocks','--width=1440','--width=375'].includes(args[i]), 'Use --key-file <path> and optional --skip-build / --stocks.'); }
  const d = loadDeployment(); check(d?.network === 'testnet' && d.rpc === RPC, 'Testnet deployment and RPC required.');
  account = d.accounts.alice;
  check(account.endsWith('.testnet'), 'Named testnet signer required.');
  const c = { credit: d.accounts.credit, collateral: d.accounts.tbtc, usdc: d.accounts.tusdc };
  const balance = (token, who = account) => view(token, 'ft_balance_of', { account_id: who });
  const position = () => view(c.credit, 'position', { borrower: account });
  stockToken = stockAccount('tTSLA', d.root);

  const initial = await position(); check(initial.debt_usd6 === '0' && initial.collateral.length === 0, 'Demo account must begin debt-free with no locked collateral.');
  const state = await provider.viewAccount({ accountId: account }); initialNear = state.amount;
  const before = { ...(stockMode ? { stock: await balance(stockToken) } : {}), collateral: await balance(c.collateral), usdc: await balance(c.usdc), shop: await balance(c.usdc, d.accounts.shop) };
  if (stockMode) check(BigInt(before.stock) >= 100_000_000n, 'Demo test stock balance is low.');
  check(BigInt(before.collateral) >= 10000n && BigInt(before.usdc) >= (stockMode ? 25_010_000n*BigInt(widths.length) : 40000n), 'Test token balances low; stopped without spending.');
  const gasPrice = BigInt((await rpc('gas_price', [null])).gas_price);
  const planned = 700_000_000_000_000n * gasPrice * 2n + 5_000_000_000_000_000_000_000n;
  check(initialNear - BigInt(state.storage_usage) * 10n ** 19n >= 90_000_000_000_000_000_000_000n, 'Testnet NEAR balance low; stopped without spending.');
  ledger = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { network: 'testnet', budgetNear: stockMode?0.5:0.3, runs: [] };
  check(ledger.network === 'testnet' && Array.isArray(ledger.runs), 'Invalid prior QA budget ledger.');
  // Keep the cap across dates and retries. Failed/in-flight runs retain their full reservation.
  reserved = readdirSync(join(root, 'deployments')).filter(name => /^qa-browser-(?:equities-)?\d{4}-\d{2}-\d{2}(?:T[^/]+)?\.json$/.test(name)).reduce((total, name) => {
    const previous = JSON.parse(readFileSync(join(root, 'deployments', name), 'utf8'));
    check(previous.network === 'testnet' && Array.isArray(previous.runs), 'Invalid prior QA budget ledger.');
    return total + previous.runs.reduce((n, r) => n + BigInt(['PASS','BLOCKED_PRICE_SOURCE'].includes(r.status) && r.budgetChargedYocto !== undefined ? r.budgetChargedYocto : r.reservedYocto ?? '0'), 0n);
  }, 0n);
  check(reserved + planned <= CAP, 'Remaining recorded QA budget is too low; stopped without spending.');
  console.log(`Preflight passed: funded testnet account, test tokens and budget below ${stockMode?'0.5':'0.3'} NEAR.`);
  mkdirSync(screenshots, { recursive: true });
  stage = 'build isolation';
  if (!args.includes('--skip-build')) {
    // QA flag alone must still be insufficient in ordinary production mode.
    await build('production', ['--filter', '@noren/web', 'build'], { VITE_QA_SIGNER: '1' });
    await build('qa', ['--filter', '@noren/web', 'exec', 'vite', 'build', '--mode', 'qa', '--outDir', qaDir, '--emptyOutDir'], { VITE_QA_SIGNER: '1' });
  }
  const builds = { production: audit(join(root, 'packages/web/dist'), false), qa: audit(qaDir, true) };
  let creds;
  try { creds = JSON.parse(readFileSync(keyPath, 'utf8')); } catch { throw Error('Credential file could not be read.'); }
  secret = creds.rootId && account.endsWith(`.${creds.rootId}`) ? creds.subKey : creds.account_id === account ? creds.private_key : null;
  check(secret && creds.relayerKey, 'Demo signer and relayer key required by file path.');
  let relayer;
  try { relayer = accountFor(account, secret); } catch { throw Error('Demo key could not be loaded.'); }
  run = { stockMode, budgetGroup:stockMode?EQUITY_BUDGET_GROUP:undefined, stockPriceSource: stockMode ? { error: stockOracleError || null, observations: stockQuotes } : undefined, startedAt: new Date().toISOString(), account, status: 'RUNNING', reservedYocto: '0', before, builds, attempts: [], transactions: [], screenshots: [], viewports: [] };
  captureDir = join(screenshots, run.startedAt.replace(/[^0-9A-Za-z]/g, '-')); mkdirSync(captureDir, { recursive: true });
  ledger.runs.push(run); save();
  const port = Array.from({ length: 700 }, (_, i) => 5300 + i).find(p => spawnSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN'], { stdio: 'ignore' }).status === 1);
  check(port, 'No free preview port in 5300-5999.');
  async function shot(p, name, width) {
    const text = await p.locator('body').innerText();
    check(!text.includes(secret), 'Credential found in visible text; screenshot refused.');
    check(!/undefined|NaN|\bArc\b|Robinhood|CCTP/.test(text), 'Invalid visible product text.');
    check(!await p.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > innerWidth), 'Horizontal overflow.');
    const path = join(captureDir, `${name}-${width}.png`); await p.screenshot({ path, fullPage: true }); run.screenshots.push({ name, width, path }); save();
  }
  await withChromeLock(async () => {
    await resources();
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      stage = 'production baseline'; const productionOrigin = await serve(join(root, 'packages/web/dist'), port);
      for (const width of widths) {
        const p = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await p.goto(productionOrigin); await p.waitForTimeout(1600); await shot(p, 'before-credit', width);
        await p.getByRole('button', { name: /Change account/ }).click(); await shot(p, 'before-account', width); await p.getByRole('button', { name: 'Close', exact: true }).click();
        await p.getByRole('tab', { name: 'Pay anyone', exact: true }).click(); await shot(p, 'before-pay', width); await p.close();
      }
      const origin = await serve(qaDir, port);
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const p = await context.newPage(); p.setDefaultTimeout(75000);
        const failures = [], responseTasks = new Set(); let secretLeak = false;
        const viewport = { width, status: 'RUNNING', failures, httpErrors: [], expectedPriceFailures: [] }; run.viewports.push(viewport); save();
        p.on('pageerror', () => { failures.push('page exception'); save(); });
        p.on('console', m => { if (m.text().includes(secret)) secretLeak = true; if (m.type() === 'error') { failures.push('console error'); save(); } });
        p.on('requestfailed', request => { const u = new URL(request.url()); failures.push({ type: 'failed request', url: u.origin + u.pathname, reason: request.failure()?.errorText }); save(); });
        p.on('response', response => {
          if (response.status() >= 400) { const u = new URL(response.url()); viewport.httpErrors.push({ status: response.status(), url: u.origin + u.pathname }); save(); }
          if (response.url() !== RPC && response.url() !== RPC + '/') return;
          let request; try { request = response.request().postDataJSON(); } catch { return; }
          if (!['send_tx', 'broadcast_tx_commit', 'broadcast_tx_async'].includes(request?.method)) return;
          const task = (async () => {
            const j = await response.json(), hash = j.result?.transaction?.hash ?? j.result?.transaction_outcome?.id ?? (typeof j.result === 'string' ? j.result : undefined);
            if (hash && !run.transactions.some(t => t.hash === hash)) { run.transactions.push({ source: 'browser', stage, width, hash, explorer: `https://testnet.nearblocks.io/txns/${hash}` }); save(); }
          })().catch(() => failures.push('transaction hash capture failed'));
          responseTasks.add(task); task.finally(() => responseTasks.delete(task));
        });
        await p.exposeFunction('__norenQaAuthorize', reserve);
        await p.addInitScript(({ origin, accountId, privateKey, rpcUrl }) => {
          if (location.origin === origin) Object.defineProperty(window, '__NOREN_QA_SIGNER__', { value: { accountId, privateKey, rpcUrl }, configurable: true });
        }, { origin, accountId: account, privateKey: secret, rpcUrl: RPC });
        stage = `connect ${width}`;
        await p.goto(origin); await p.getByRole('button', { name: /Change account/ }).click();
        await p.getByRole('button', { name: 'Connect Meteor Wallet', exact: true }).click();
        await p.getByRole('button', { name: 'Sign out of Meteor', exact: true }).waitFor();
        await p.waitForFunction(id => document.querySelector('input[placeholder="you.testnet"]')?.value === id, account);
        check(await p.evaluate(() => window.__NOREN_QA_SIGNER__ === undefined), 'Credential injection was not consumed.');
        await shot(p, 'connected', width);
        async function final(name) {
          await p.getByText('Pending on NEAR testnet…', { exact: true }).waitFor(); await shot(p, `${name}-pending`, width);
          await p.getByText('Final on NEAR testnet', { exact: true }).waitFor();
          await Promise.all([...responseTasks]);
          const links = await p.locator('.nc-receipt a').evaluateAll(as => as.map(a => a.href));
          check(links.length > 0, 'Final receipt has no NearBlocks link.');
          for (const link of links) {
            check(link.startsWith('https://testnet.nearblocks.io/txns/'), 'Wrong receipt explorer.');
            const hash = link.split('/').at(-1), tx = run.transactions.find(t => t.hash === hash);
            check(tx, 'Broadcast hash missing from evidence.'); tx.final = true; tx.action = name;
          }
          await shot(p, `${name}-final`, width); save();
        }
        if(stockMode){stage=`equity quote ${width}`;const signed=freshSignedEquity((await view(c.credit,'assets',{})).find(a=>a.token===stockToken));if(signed){stockQuotes=[signed];}else{stockQuotes=await equityPrices(['tTSLA']);stockFetchedAt=Date.now();}check(stockQuotes[0]?.fresh,'US equity market is closed or the quote is older than 90 seconds; stopped before a deposit.');run.stockPriceSource={error:null,observations:stockQuotes};save();}
        stage = `deposit ${width}`;
        await p.getByRole('button', { name: /^Deposit collateral/ }).click(); await p.getByLabel('Collateral token').selectOption(c.collateral); await p.getByLabel('Test WBTC amount').fill('0.0001');
        await shot(p, 'deposit', width); await p.getByRole('button', { name: 'Deposit collateral', exact: true }).click(); await final('deposit');
        check((await position()).collateral.some(c => c.amount === '10000'), 'Collateral deposit not reflected on chain.');
        await p.getByRole('button', { name: 'Close', exact: true }).click();
        await p.getByRole('tab', { name: 'Credit', exact: true }).click();
        await p.waitForFunction(() => [...document.querySelectorAll('.nc-coins li')].some(el => el.textContent?.includes('test WBTC') && el.querySelector('.r b')?.textContent === '0.0001')); await shot(p, 'position-deposited', width);
        if (stockMode) {
          stage = `stock deposit ${width}`;
          await p.getByRole('button',{name:/Change account/}).click();await p.getByRole('button',{name:/^Deposit collateral/}).click();await p.getByLabel('Collateral token').selectOption(stockToken);await p.getByLabel('Test TSLA amount').fill('1');await p.getByRole('button',{name:'Deposit collateral',exact:true}).click();await final('stock-deposit');await p.getByRole('button',{name:'Close',exact:true}).click();
          check((await position()).collateral.some(c=>c.token===stockToken&&c.amount==='100000000'),'Stock deposit not reflected on chain.');await shot(p,'position-mixed',width);await p.getByRole('tab',{name:'Debt-free',exact:true}).click();await p.getByText('No stock yield model',{exact:true}).waitFor();await shot(p,'stock-no-yield',width);await p.getByRole('tab',{name:'Credit',exact:true}).click();
          // Prefer a still-fresh quote already verified by the contract over another upstream request.
          const signed=freshSignedEquity((await view(c.credit,'assets',{})).find(a=>a.token===stockToken));
          if(signed){stockQuotes=[signed];stockOracleError='';(run.reusedPrices??=[]).push({width,stage:'before draw',...signed});}
          else {stockOracleError='';try{const current=stockQuotes.find(p=>p.symbol==='tTSLA');if(!current||Math.floor(Date.now()/1000)-current.publishTime>60){const wait=60000-(Date.now()-stockFetchedAt);if(wait>0)await sleep(wait);stockQuotes=await equityPrices(['tTSLA']);stockFetchedAt=Date.now();}if(!stockQuotes.find(p=>p.symbol==='tTSLA')?.fresh)stockOracleError='Equity market is closed or the original quote is older than 90 seconds.';}catch(e){stockOracleError=e instanceof Error?e.message:'Equity price source unavailable.';}}
          run.stockPriceSource={error:stockOracleError||null,observations:stockQuotes};save();
          if (stockOracleError) {
            stage = `stock borrow blocked ${width}`;
            check(!(await position()).prices_fresh,'Upstream unavailable while signed prices remain valid; do not send an error-probe payment.');
            await p.getByRole('tab',{name:'Pay anyone',exact:true}).click();await p.locator('#nc-amt').fill('0.01');await p.getByRole('button',{name:'Borrow and pay shop',exact:true}).click();await p.getByRole('alert').filter({hasText:'A collateral price is stale'}).waitFor();await shot(p,'stock-price-blocked',width);
            for (const [token,label,amount,name] of [[stockToken,'Test TSLA amount','1','stock-withdraw'],[c.collateral,'Test WBTC amount','0.0001','withdraw']]) {
              stage = `${name} ${width}`;await p.getByRole('button',{name:/Change account/}).click();await p.getByRole('button',{name:/^Withdraw collateral/}).click();await p.getByLabel('Collateral token').selectOption(token);await p.getByLabel(label).fill(amount);await p.getByRole('button',{name:'Withdraw collateral',exact:true}).click();await final(name);await p.getByRole('button',{name:'Close',exact:true}).click();
            }
            await p.getByRole('tab',{name:'Credit',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.nc-hero')?.textContent?.includes('No collateral'));await shot(p,'position-restored',width);
            const restored=await position();check(restored.debt_usd6==='0'&&restored.collateral.length===0,'Blocked run left collateral or debt.');check(await balance(stockToken)===before.stock&&await balance(c.collateral)===before.collateral,'Token balances not restored.');check(await balance(c.usdc,d.accounts.shop)===before.shop,'A blocked draw unexpectedly paid the shop.');
            check(!failures.length&&!secretLeak,`Unexpected browser errors in blocked-price flow: ${JSON.stringify(failures)}`);Object.assign(viewport,{status:'BLOCKED_PRICE_SOURCE',reason:stockOracleError,position:restored,overflow:false});save();await context.close();console.log(`${width}: real mixed-collateral deposits/withdrawals PASS; borrow BLOCKED by equity price source`);continue;
          }
        }
        stage = `price refresh ${width}`;
        const spot = await fetchBtcSpot(), { message: _, ...price } = signPrice(creds.relayerKey, c.credit, c.collateral, spot.priceUsd6, spot.timestampNs);
        await reserve({ receiverId: c.credit, gas: '30000000000000', deposit: '0' });
        const result = await relayer.signAndSendTransaction({ receiverId: c.credit, actions: [actions.functionCall('post_signed_price', price, 30_000_000_000_000n, 0n)], waitUntil: 'FINAL', throwOnFailure: false });
        run.transactions.push({ source: 'node price relayer', width, action: 'price', hash: result.transaction.hash, final: !result.status.Failure, explorer: `https://testnet.nearblocks.io/txns/${result.transaction.hash}` }); save();
        check(!result.status.Failure, 'Price refresh failed.');
        if (stockMode) {
          const quote=stockQuotes.find(p=>p.symbol==='tTSLA');check(quote?.fresh,'No fresh TSLA quote.');
          const posted=(await view(c.credit,'assets',{})).find(a=>a.token===stockToken);
          if(posted?.price_fresh && BigInt(posted.price_at_ns)>=BigInt(quote.timestampNs) && posted.price_usd6===quote.priceUsd6) { (run.reusedPrices??=[]).push({width,token:stockToken,timestampNs:posted.price_at_ns,source:posted.source});save(); }
          else {
          const {message:_,...args}=signPrice(creds.relayerKey,c.credit,stockToken,BigInt(quote.priceUsd6),BigInt(quote.timestampNs),quote.source);
          await reserve({receiverId:c.credit,gas:'30000000000000',deposit:'0'});
          const tx=await relayer.signAndSendTransaction({receiverId:c.credit,actions:[actions.functionCall('post_signed_price',args,30_000_000_000_000n,0n)],waitUntil:'FINAL',throwOnFailure:false});run.transactions.push({source:'node equity relayer',width,action:'stock-price',hash:tx.transaction.hash,final:!tx.status.Failure,explorer:`https://testnet.nearblocks.io/txns/${tx.transaction.hash}`});save();check(!tx.status.Failure,'Stock price relay failed.');
          }
        }
        stage = `borrow ${width}`;
        await p.getByRole('tab', { name: 'Pay anyone', exact: true }).click(); await p.locator('#nc-amt').fill(stockMode?'25':'0.01'); await p.locator('#nc-to').fill(d.accounts.shop);
        await p.getByRole('button', { name: 'Borrow and pay shop', exact: true }).click(); await final('borrow');
        const drawn=await position();check(BigInt(drawn.debt_usd6) >= (stockMode?25_000_000n:10000n), 'Borrowed debt not reflected on chain.');check(BigInt(drawn.health_bps ?? '0') > 10000n, 'Borrowed position must remain healthy.');
        await p.getByRole('tab', { name: 'Credit', exact: true }).click();
        viewport.borrowedPosition=drawn;save();await p.waitForFunction(value => document.querySelector('.nc-hero .nc-tiles')?.textContent?.includes(value),stockMode?'$25.00':'$0.01'); await shot(p, 'position-borrowed', width);
        for (const [action, label] of [['repay', 'Repay credit'], ['withdraw', 'Withdraw collateral']]) {
          if (stockMode && action==='withdraw') {
            stage=`stock withdraw ${width}`;await p.getByRole('button',{name:/Change account/}).click();await p.getByRole('button',{name:/^Withdraw collateral/}).click();await p.getByLabel('Collateral token').selectOption(stockToken);await p.getByLabel('Test TSLA amount').fill('1');await p.getByRole('button',{name:'Withdraw collateral',exact:true}).click();await final('stock-withdraw');await p.getByRole('button',{name:'Close',exact:true}).click();
          }
          stage = `${action} ${width}`;
          await p.getByRole('button', { name: /Change account/ }).click(); await p.getByRole('button', { name: new RegExp('^' + label) }).click();
          if(action==='withdraw')await p.getByLabel('Collateral token').selectOption(c.collateral);
          await p.getByLabel(action === 'repay' ? 'Test USDC amount' : 'Test WBTC amount').fill(action === 'repay' ? (stockMode?'25.01':'0.02') : '0.0001');
          await p.getByRole('button', { name: action === 'repay' ? 'Repay your credit' : 'Withdraw collateral', exact: true }).click(); await final(action);
          await p.getByRole('button', { name: 'Close', exact: true }).click();
        }
        const after = await position();
        check(after.debt_usd6 === '0' && after.collateral.length === 0, 'Final position must be debt-free with no locked collateral.');
        check(await balance(c.collateral) === before.collateral, 'Collateral wallet balance not restored.');
        if(stockMode)check(await balance(stockToken)===before.stock,'Stock wallet balance not restored.');
        check(BigInt(await balance(c.usdc, d.accounts.shop)) - BigInt(before.shop) === BigInt(run.viewports.length) * (stockMode?25_000_000n:10000n), 'Shop did not receive the exact payments.');
        await p.waitForFunction(() => document.querySelector('.nc-hero')?.textContent?.includes('No collateral')); await shot(p, 'position-restored', width);
        await p.getByRole('tab', { name: 'Debt-free', exact: true }).click(); await shot(p, 'debt-free', width);
        stage = `sign out ${width}`;
        await p.getByRole('button', { name: /Change account/ }).click(); await p.getByRole('button', { name: 'Sign out of Meteor', exact: true }).click();
        await p.getByRole('button', { name: 'Connect Meteor Wallet', exact: true }).waitFor();
        check(!failures.length && !secretLeak, 'Browser errors, failed requests or credential logging detected.');
        Object.assign(viewport, { status: 'PASS', pageExceptions: 0, consoleErrors: 0, failedRequests: 0, overflow: false, position: after }); save();
        await context.close(); console.log(`${width}: real browser deposit, shop payment, repayment and withdrawal PASS`);
      }
      run.after = { ...(stockMode ? {stock: await balance(stockToken)} : {}), collateral: await balance(c.collateral), shop: await balance(c.usdc, d.accounts.shop), position: await position() };
      run.status = stockMode&&stockOracleError ? 'BLOCKED_PRICE_SOURCE' : 'PASS'; if(run.status!=='PASS')process.exitCode=2; save();
    } finally { await browser.close(); browser = undefined; await stopServer(); }
  });
}
try { await main(); }
catch (error) { const safe = ['Testnet NEAR balance low; stopped without spending.', 'Test token balances low; stopped without spending.', 'Remaining recorded QA budget is too low; stopped without spending.', 'Demo account must begin debt-free with no locked collateral.'].includes(error?.message) ? ` ${error.message}` : ''; if (run) { run.status = 'FAILED'; run.error = `Stopped at ${stage}; no raw provider or credential details are recorded.`; save(); } console.error(`QA browser test stopped at ${stage}.${safe} Check funding, the public evidence and build logs. No credential contents are displayed.`); process.exitCode = 1; }
finally {
  if (browser) await browser.close().catch(() => {});
  await stopServer();
  if (run && initialNear !== undefined) {
    try { run.totalNearSpentYocto = (initialNear - (await provider.viewAccount({ accountId: account })).amount).toString();
      run.totalNearSpent = Number(run.totalNearSpentYocto) / 1e24;
      let burned = 0n;
      for (const transaction of run.transactions) {
        const receipt = await rpc('tx', { tx_hash: transaction.hash, sender_account_id: account, wait_until: 'FINAL' });
        check(receipt.final_execution_status === 'FINAL', 'An authorized transaction is still pending.');
        const fee = [receipt.transaction_outcome, ...(receipt.receipts_outcome ?? [])].reduce((n, item) => n + BigInt(item.outcome.tokens_burnt), 0n);
        transaction.tokensBurntYocto = fee.toString(); burned += fee;
      }
      const gasAndDeposits = burned + run.attempts.reduce((n, item) => n + BigInt(item.deposit), 0n);
      run.budgetChargedYocto = (gasAndDeposits > BigInt(run.totalNearSpentYocto) ? gasAndDeposits : BigInt(run.totalNearSpentYocto)).toString();
      check(BigInt(run.budgetChargedYocto) <= BigInt(run.reservedYocto), 'Actual cost exceeded the reserved budget.'); }
    catch { run.status = 'FAILED'; run.error = 'Final balance verification failed.'; process.exitCode = 1; }
    run.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ status: run.status, totalNearSpent: run.totalNearSpent, evidence: output }));
  }
  secret = undefined;
}
