// Runs exactly the browser's shared credit-call pipeline with a demo key read by file path.
// pnpm near:wallet-cycle --key-file .near-credentials/testnet.json [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { actions } from 'near-api-js';
import { runCreditAction } from '../packages/web/src/near/credit-runtime.ts';
import { creditCall, walletError } from '../packages/web/src/near/credit-calls.ts';
import { accountFor, loadDeployment, saveDeployment, view, fetchBtcSpot, signPrice, send, provider } from './near-lib.ts';
const argv = process.argv.slice(2), keyIndex = argv.indexOf('--key-file');
if (argv.some(x => x.startsWith('--') && !['--key-file', '--dry'].includes(x))) throw Error('Use --key-file <path> and optional --dry.');
const d = loadDeployment(); if (!d || d.network !== 'testnet') throw Error('Testnet deployment required.');
const account = d.accounts.alice, c = { credit: d.accounts.credit, collateral: d.accounts.tbtc, usdc: d.accounts.tusdc };
if (argv.includes('--dry')) { console.log(JSON.stringify(['deposit', 'borrow', 'repay', 'withdraw'].map(x => creditCall(x, c, x === 'repay' ? '20000' : '10000', account, x === 'borrow' ? d.accounts.shop : account)), null, 2)); process.exit(0); }
if (keyIndex < 0 || !argv[keyIndex + 1] || argv[keyIndex + 1].startsWith('--')) throw Error('Supply --key-file <path>; no key values belong on the command line.');
let key;
try { key = JSON.parse(readFileSync(resolve(argv[keyIndex + 1]), 'utf8')); } catch { throw Error('The credential file could not be read as JSON. No credential contents are displayed.'); }
const secret = key.rootId && account.endsWith(`.${key.rootId}`) ? key.subKey : key.account_id === account ? key.private_key : null;
if (!secret || !key.relayerKey) throw Error('Demo signer and relayer are required in the credential file.');
let signer;
try { signer = accountFor(account, secret); } catch { throw Error('The demo signing key in that file could not be loaded.'); }
const initialAccount = await provider.viewAccount({ accountId: account });
const initial = await view(c.credit, 'position', { borrower: account });
if (initial.debt_usd6 !== '0' || initial.collateral.length) throw Error('Alice must start debt-free with no locked collateral.');
if (initialAccount.amount < 90_000_000_000_000_000_000_000n) throw Error('Balance too low; skipped without spending.');
const tokenBalance = (token, who) => view(token, 'ft_balance_of', { account_id: who });
const before = { collateral: await tokenBalance(c.collateral, account), usdc: await tokenBalance(c.usdc, account), shop: await tokenBalance(c.usdc, d.accounts.shop) };
if (BigInt(before.collateral) < 10000n || BigInt(before.usdc) < 20000n) throw Error('Test token balances too low; skipped without spending.');
const gas = await fetch('https://test.rpc.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'budget', method: 'gas_price', params: [null] }) }).then(r => r.json());
const bound = BigInt(gas.result.gas_price) * 370_000_000_000_000n + 2_500_000_000_000_000_000_000n;
if (bound >= 300_000_000_000_000_000_000_000n) throw Error('Gas upper bound exceeds the 0.3 NEAR QA budget.');
const evidence = { network: 'testnet', account, observedAt: new Date().toISOString(), upperBoundNear: Number(bound) / 1e24, calls: [], before };
const output = resolve('deployments/wallet-cycle-2026-11-11.json');
let action = 'deposit';
const adapter = {
  account,
  sign: async call => {
    evidence.calls.push({ action, ...call }); writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    return await signer.signAndSendTransaction({ receiverId: call.receiverId, actions: [actions.functionCall(call.methodName, call.args, BigInt(call.gas), BigInt(call.deposit))], waitUntil: 'FINAL', throwOnFailure: false });
  },
  onEvent: e => {
    if (e.state !== 'final') return;
    const record = loadDeployment(); record.steps.push({ step: `Wallet call-path QA: alice ${action}`, account, method: e.call.methodName, hash: e.hash, status: 'success', explorer: `https://testnet.nearblocks.io/txns/${e.hash}` }); saveDeployment(record);
    evidence.calls.at(-1).hash = e.hash; writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    console.log(`${action}: final https://testnet.nearblocks.io/txns/${e.hash}`);
  },
};
try {
  await runCreditAction('deposit', c, '10000', account, adapter);
  const spot = await fetchBtcSpot(), { message: _, ...price } = signPrice(key.relayerKey, c.credit, c.collateral, spot.priceUsd6, spot.timestampNs);
  await send(loadDeployment(), signer, 'Wallet call-path QA: fresh signed BTC price', c.credit, [actions.functionCall('post_signed_price', price, 30_000_000_000_000n, 0n)], { method: 'post_signed_price' });
  action = 'borrow'; await runCreditAction(action, c, '10000', d.accounts.shop, adapter);
  action = 'repay'; await runCreditAction(action, c, '20000', account, adapter);
  action = 'withdraw'; await runCreditAction(action, c, '10000', account, adapter);
  evidence.after = { collateral: await tokenBalance(c.collateral, account), shop: await tokenBalance(c.usdc, d.accounts.shop), position: await view(c.credit, 'position', { borrower: account }) };
  if (evidence.after.collateral !== before.collateral || evidence.after.position.debt_usd6 !== '0' || BigInt(evidence.after.shop) - BigInt(before.shop) !== 10000n) throw Error('Post-cycle invariant failed.');
  evidence.status = 'PASS';
} catch (error) { evidence.status = 'FAILED'; evidence.error = walletError(error); process.exitCode = 1; }
finally {
  evidence.totalNearSpent = Number(initialAccount.amount - (await provider.viewAccount({ accountId: account })).amount) / 1e24;
  if (evidence.totalNearSpent > 0.3) { evidence.status = 'BUDGET_EXCEEDED'; process.exitCode = 1; }
  writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, totalNearSpent: evidence.totalNearSpent, ...(evidence.error ? { error: evidence.error } : {}) }));
}
