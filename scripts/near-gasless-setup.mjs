/**
 * One-time NEAR testnet setup for gasless checkout (NEP-366):
 *  1. creates relayer.<root> with a fresh full-access key (saved to the gitignored .near-credentials/gas-relayer.json);
 *  2. creates the shopper riya.<root> with a zero NEAR balance and gives her test USDC (storage and mint paid by root).
 * Shopper keys go to the gitignored .near-credentials/shopper-riya.json.
 * Nothing prints a key. Evidence: deployments/gasless-setup-<time>.json.  Usage: node scripts/near-gasless-setup.mjs
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { loadCreds, loadDeployment, accountFor, provider, credsDir, root } from './near-lib.ts';
const require = createRequire(resolve(root, 'package.json'));
const { KeyPair, actions } = require('near-api-js');

const d = loadDeployment(), creds = loadCreds();
if (!d || !creds || d.network !== 'testnet') throw Error('Setup required: the testnet deployment record and .near-credentials/testnet.json.');
const relayerId = 'relayer.' + d.root, shopper = 'riya.' + d.root, keyFile = resolve(credsDir, 'gas-relayer.json');
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), out = resolve(root, `deployments/gasless-setup-${stamp}.json`);
const R = { network: 'testnet', relayer: relayerId, shopper, startedAt: new Date().toISOString(), steps: [] };
const save = () => writeFileSync(out, JSON.stringify(R, (k, v) => typeof v === 'bigint' ? String(v) : v, 2) + '\n');
const bal = async id => BigInt((await provider.viewAccount({ accountId: id })).amount);
const exists = async id => { try { await provider.viewAccount({ accountId: id }); return true; } catch { return false; } };
const burnt = r => [r.transaction_outcome, ...r.receipts_outcome].reduce((s, o) => s + BigInt(o.outcome.tokens_burnt), 0n);
async function send(signer, step, receiverId, acts) {
  const r = await signer.signAndSendTransaction({ receiverId, actions: acts, waitUntil: 'FINAL', throwOnFailure: false });
  const ok = !r.status.Failure && !r.receipts_outcome.some(x => x.outcome.status.Failure);
  R.steps.push({ step, signer: signer.accountId, hash: r.transaction.hash, ok, tokensBurnt: burnt(r), explorer: `https://testnet.nearblocks.io/txns/${r.transaction.hash}` }); save();
  console.log(ok ? 'ok ' : 'BAD', step, `https://testnet.nearblocks.io/txns/${r.transaction.hash}`);
  if (!ok) throw Error(`${step} failed: ${JSON.stringify(r.status.Failure ?? '').slice(0, 300)}`);
  return r;
}

// 1. The relayer account (Noren-owned, full-access key so it can submit Delegate actions).
if (!await exists(relayerId)) {
  if (existsSync(keyFile)) throw Error(`${keyFile} exists but ${relayerId} does not. Move the file aside first.`);
  const key = KeyPair.fromRandom('ed25519');
  writeFileSync(keyFile, JSON.stringify({ accountId: relayerId, privateKey: key.toString() }), { mode: 0o600 });
  await send(accountFor(d.root, creds.rootKey), 'create-relayer', relayerId, [actions.createAccount(), actions.addFullAccessKey(key.getPublicKey())]);
} else if (!existsSync(keyFile)) throw Error(`${relayerId} exists but its key file is missing.`);

// 2. The shopper: a new account created with a zero balance (NEP-448: under 770 bytes of storage needs no NEAR).
//    A drained account can't reach exactly 0 (a transfer's upfront fee is refunded later), so the shopper is born at 0.
//    Root pays her test-USDC storage and mints her test USDC; she never receives NEAR.
const shopperKeyFile = resolve(credsDir, 'shopper-riya.json');
if (!await exists(shopper)) {
  if (existsSync(shopperKeyFile)) throw Error(`${shopperKeyFile} exists but ${shopper} does not. Move the file aside first.`);
  const key = KeyPair.fromRandom('ed25519');
  writeFileSync(shopperKeyFile, JSON.stringify({ accountId: shopper, privateKey: key.toString() }), { mode: 0o600 });
  await send(accountFor(d.root, creds.rootKey), 'create-shopper-zero-balance', shopper, [actions.createAccount(), actions.addFullAccessKey(key.getPublicKey())]);
} else if (!existsSync(shopperKeyFile)) throw Error(`${shopper} exists but its key file is missing.`);
const rootAcct = accountFor(d.root, creds.rootKey), usdc = d.accounts.tusdc;
const ft = async id => BigInt(await provider.callFunction({ contractId: usdc, method: 'ft_balance_of', args: { account_id: id } }));
if (!await provider.callFunction({ contractId: usdc, method: 'storage_balance_of', args: { account_id: shopper } }))
  await send(rootAcct, 'shopper-usdc-storage', usdc, [actions.functionCall('storage_deposit', { account_id: shopper, registration_only: true }, 10_000_000_000_000n, 1_250_000_000_000_000_000_000n)]);
if (await ft(shopper) < 50_000_000n) await send(rootAcct, 'mint-shopper-test-usdc', usdc, [actions.functionCall('mint', { account_id: shopper, amount: '100000000' }, 20_000_000_000_000n, 0n)]);

// 3. Earlier run: alice's NEAR went to the relayer before this script switched to a zero-balance shopper. Return all
//    but 0.025 NEAR so alice keeps paying her own gas in the other filmed flows (only with --return-alice).
const keep = 25_000_000_000_000_000_000_000n, relayerBal = await bal(relayerId);
if (process.argv.includes('--return-alice') && relayerBal > keep + 10n ** 22n) {
  const r = loadRelayerAccount();
  await send(r, 'return-alice-near', d.accounts.alice, [actions.transfer(relayerBal - keep)]);
}
function loadRelayerAccount() { const c = JSON.parse(require('node:fs').readFileSync(keyFile, 'utf8')); return accountFor(c.accountId, c.privateKey); }
R.after = { shopperNear: await bal(shopper), shopperUsdc: await ft(shopper), relayerNear: await bal(relayerId), aliceNear: await bal(d.accounts.alice) };
R.finishedAt = new Date().toISOString(); save();
console.log('shopper', shopper, 'NEAR (yocto):', String(R.after.shopperNear), '| test USDC:', Number(R.after.shopperUsdc) / 1e6, '| relayer NEAR:', (Number(R.after.relayerNear) / 1e24).toFixed(5), '| evidence', out);
