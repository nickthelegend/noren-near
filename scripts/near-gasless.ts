/**
 * Live NEAR testnet run of gasless checkout (NEP-366), through the real merchant service and relayer code:
 * an Aubelle order is created, the zero-NEAR shopper signs a DelegateAction for the invoice-bound test-USDC transfer,
 * Noren's relayer submits and pays for it, and the merchant verifies the FINAL receipt. Then two refusals that cost
 * no gas (a replay for the paid link and a tampered amount). Evidence: deployments/gasless-<time>.json.
 * Usage: pnpm near:gasless
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { actions } from 'near-api-js';
import { accountFor, credsDir, provider, root, RPC } from './near-lib.ts';
import { createMerchantService, USDC, DEMO_SHOP } from '../packages/merchant/src/service.ts';

const shopper = JSON.parse(readFileSync(resolve(credsDir, 'shopper-riya.json'), 'utf8')) as { accountId: string; privateKey: string };
const riya = accountFor(shopper.accountId, shopper.privateKey); shopper.privateKey = '';
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), out = resolve(root, `deployments/gasless-${stamp}.json`);
const R: Record<string, unknown> = { network: 'testnet', nep: 'NEP-366 meta-transaction', shopper: riya.accountId, merchantPayout: DEMO_SHOP, startedAt: new Date().toISOString() };
const save = () => writeFileSync(out, JSON.stringify(R, (_, v) => typeof v === 'bigint' ? String(v) : v, 2) + '\n');
const near = async (id: string) => BigInt((await provider.viewAccount({ accountId: id })).amount);
const ft = async (id: string) => BigInt(await provider.callFunction({ contractId: USDC, method: 'ft_balance_of', args: { account_id: id } }) as string);
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
const host = 'localhost:5395';

const s = createMerchantService({ file: null });
const status = await s.handle('/relay', 'GET', {}, '', host);
if (!status.ready) throw Error(`Setup required: ${status.missing.join(', ')}`);
const relayer = status.relayer as string;
R.relayer = relayer; R.limits = status.limits;

const order = await s.handle('/shop/checkout', 'POST', { lines: [{ slug: 'amelie-gingham', size: 'S', qty: 1 }] }, '', host);
const invoiceId = order.checkoutUrl.split('/').at(-1) as string;
const inv = await s.handle(`/invoices/${invoiceId}`, 'GET', {}, '', host);
R.order = { orderId: order.orderId, invoiceId, amount: inv.invoice.amount, description: inv.description };
R.before = { shopperNear: await near(riya.accountId), shopperUsdc: await ft(riya.accountId), shopUsdc: await ft(DEMO_SHOP), relayerNear: await near(relayer) }; save();

async function signedFor(amount: string) {
  const args = { receiver_id: DEMO_SHOP, amount, memo: `noren:${invoiceId}` };
  const r = await riya.createSignedMetaTransaction({ receiverId: USDC, actions: [actions.functionCall('ft_transfer', args, 15_000_000_000_000n, 1n)], blockHeightTtl: 120 });
  const d = r.signedDelegate.delegateAction;
  return { senderId: d.senderId, receiverId: d.receiverId, nonce: String(d.nonce), maxBlockHeight: String(d.maxBlockHeight), publicKey: d.publicKey.toString(),
    actions: d.actions.map(a => ({ methodName: a.functionCall!.methodName, args: b64(a.functionCall!.args), gas: String(a.functionCall!.gas), deposit: String(a.functionCall!.deposit) })),
    signature: b64(r.signedDelegate.signature.data) };
}

// Refusal before any gas: a signed payment whose expiry block was edited after signing.
const forged = await signedFor(inv.invoice.amount);
forged.maxBlockHeight = String(BigInt(forged.maxBlockHeight) - 1n);
R.refusals = [] as { case: string; error: string }[];
try { await s.handle('/relay', 'POST', { invoiceId, delegate: forged }, '', host); throw Error('tampered payment was relayed'); }
catch (e) { (R.refusals as unknown[]).push({ case: 'field edited after signing', error: (e as Error).message }); }

// The gasless payment.
const sent = await s.handle('/relay', 'POST', { invoiceId, delegate: await signedFor(inv.invoice.amount) }, '', host);
R.relay = sent; save();
console.log('relayed', `https://testnet.nearblocks.io/txns/${sent.hash}`);
const paid = await s.handle(`/invoices/${invoiceId}/complete`, 'POST', { hash: sent.hash, accountId: riya.accountId }, '', host);
R.merchantReceipt = { status: paid.status, paidAmount: paid.paidAmount, method: paid.method, gasPaidBy: paid.gasPaidBy, paymentTx: paid.paymentTx };

// Replay for the already-paid link: refused by the relayer without spending gas.
try { await s.handle('/relay', 'POST', { invoiceId, delegate: await signedFor(inv.invoice.amount) }, '', host); throw Error('paid link was relayed again'); }
catch (e) { (R.refusals as unknown[]).push({ case: 'second payment for a paid link', error: (e as Error).message }); }

// What the chain says: outer signer = relayer, inner sender = shopper.
const tx = await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'g', method: 'tx', params: { tx_hash: sent.hash, sender_account_id: relayer, wait_until: 'FINAL' } }) })).json();
const t = tx.result.transaction, d = t.actions[0].Delegate.delegate_action;
R.chain = { finality: tx.result.final_execution_status, outerSigner: t.signer_id, outerReceiver: t.receiver_id, outerAction: 'Delegate', innerSender: d.sender_id, innerReceiver: d.receiver_id,
  innerMethod: (d.actions[0].FunctionCall ?? d.actions[0].NonDelegateAction?.FunctionCall).method_name,
  usdcLogs: tx.result.receipts_outcome.filter((r: any) => r.outcome.executor_id === USDC).flatMap((r: any) => r.outcome.logs),
  tokensBurnt: [tx.result.transaction_outcome, ...tx.result.receipts_outcome].reduce((a: bigint, o: any) => a + BigInt(o.outcome.tokens_burnt), 0n) };
R.after = { shopperNear: await near(riya.accountId), shopperUsdc: await ft(riya.accountId), shopUsdc: await ft(DEMO_SHOP), relayerNear: await near(relayer) };
const b = R.before as Record<string, bigint>, a = R.after as Record<string, bigint>, amount = BigInt(inv.invoice.amount);
R.checks = {
  outerSignerIsRelayer: t.signer_id === relayer, innerSenderIsShopper: d.sender_id === riya.accountId,
  shopperNearUnchanged: a.shopperNear === b.shopperNear, shopperNearIsZero: a.shopperNear === 0n,
  shopperPaidExactly: b.shopperUsdc - a.shopperUsdc === amount, merchantReceivedExactly: a.shopUsdc - b.shopUsdc === amount,
  relayerPaidGas: a.relayerNear < b.relayerNear, merchantVerified: paid.status === 'paid' && paid.gasPaidBy === relayer,
};
R.status = Object.values(R.checks as Record<string, boolean>).every(Boolean) ? 'PASS' : 'FAIL';
R.finishedAt = new Date().toISOString(); save();
console.log(R.status, JSON.stringify(R.checks), '| relayer spent', (Number(b.relayerNear - a.relayerNear) / 1e24).toFixed(6), 'NEAR | evidence', out);
if (R.status !== 'PASS') process.exitCode = 1;
