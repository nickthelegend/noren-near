// Gas relayer policy (NEP-366). Pure checks with real ed25519 keys and real borsh encoding; no chain is touched here.
// The live testnet run is scripts/near-gasless.mjs (deployments/gasless-*.json).
import { describe, expect, it } from 'vitest';
import { KeyPair, actions, buildDelegateAction, encodeDelegateAction } from 'near-api-js';
import { createHash } from 'node:crypto';
import { checkRelayPolicy, rebuildSigned, RELAY_LIMITS, type RelayRecord, type WireDelegate } from './relayer';
import { createMerchantService, DEMO_SHOP, USDC } from './service';

const invoiceId = '0x' + 'b'.repeat(64), payout = 'shop.testnet', sender = 'riya.testnet';
const b64 = (s: string) => Buffer.from(s).toString('base64');
function signed(over: Partial<{ receiverId: string; method: string; args: Record<string, unknown>; gas: bigint; deposit: bigint; maxBlockHeight: bigint; nonce: bigint; senderId: string }> = {}, key = KeyPair.fromRandom('ed25519')): WireDelegate {
  const o = { receiverId: USDC, method: 'ft_transfer', args: { receiver_id: payout, amount: '12000000', memo: `noren:${invoiceId}` }, gas: 15_000_000_000_000n, deposit: 1n, maxBlockHeight: 1120n, nonce: 7n, senderId: sender, ...over };
  const argBytes = new TextEncoder().encode(JSON.stringify(o.args));
  const da = buildDelegateAction({ senderId: o.senderId, receiverId: o.receiverId, nonce: o.nonce, maxBlockHeight: o.maxBlockHeight, publicKey: key.getPublicKey(), actions: [actions.functionCall(o.method, argBytes, o.gas, o.deposit)] });
  const sig = key.sign(new Uint8Array(createHash('sha256').update(encodeDelegateAction(da)).digest())).signature;
  return { senderId: o.senderId, receiverId: o.receiverId, nonce: String(o.nonce), maxBlockHeight: String(o.maxBlockHeight), publicKey: key.getPublicKey().toString(), actions: [{ methodName: o.method, args: Buffer.from(argBytes).toString('base64'), gas: String(o.gas), deposit: String(o.deposit) }], signature: Buffer.from(sig).toString('base64') };
}
const now = 1794600000;
const ctx = (relays: RelayRecord[] = []) => ({ invoiceId, payout, remaining: 12_000_000n, height: 1000n, relays, now });

describe('gas relayer policy', () => {
  it('accepts one invoice-bound test-USDC transfer and verifies the shopper signature over the NEP-461 hash', () => {
    const w = signed();
    expect(checkRelayPolicy(w, ctx()).args.amount).toBe('12000000');
    expect(rebuildSigned(w).delegateAction.senderId).toBe(sender);
  });
  it('refuses receivers and methods outside the allowlist, and more than one action', () => {
    expect(() => checkRelayPolicy(signed({ receiverId: 'credit.noren.testnet' }), ctx())).toThrow('test USDC contract only');
    expect(() => checkRelayPolicy(signed({ method: 'ft_transfer_call' }), ctx())).toThrow('ft_transfer payment call only');
    expect(() => checkRelayPolicy(signed({ method: 'storage_withdraw' }), ctx())).toThrow('ft_transfer');
    const two = signed(); two.actions.push(two.actions[0]);
    expect(() => checkRelayPolicy(two, ctx())).toThrow('exactly one');
  });
  it('binds the payment to this merchant, this invoice and the exact amount due', () => {
    expect(() => checkRelayPolicy(signed({ args: { receiver_id: 'thief.testnet', amount: '12000000', memo: `noren:${invoiceId}` } }), ctx())).toThrow('does not pay this merchant');
    expect(() => checkRelayPolicy(signed({ args: { receiver_id: payout, amount: '12000000', memo: 'noren:0xother' } }), ctx())).toThrow('not bound to this invoice');
    expect(() => checkRelayPolicy(signed({ args: { receiver_id: payout, amount: '99000000', memo: `noren:${invoiceId}` } }), ctx())).toThrow('amount due');
    expect(() => checkRelayPolicy(signed({ args: { receiver_id: payout, amount: '12000000', memo: `noren:${invoiceId}`, msg: 'x' } }), ctx())).toThrow('only');
  });
  it('caps gas at 15 Tgas, requires exactly 1 yoctoNEAR, and refuses expired or long-lived signatures', () => {
    expect(() => checkRelayPolicy(signed({ gas: RELAY_LIMITS.maxGas + 1n }), ctx())).toThrow('15 Tgas');
    expect(() => checkRelayPolicy(signed({ deposit: 10n ** 24n }), ctx())).toThrow('exactly 1 yoctoNEAR');
    expect(() => checkRelayPolicy(signed({ deposit: 0n }), ctx())).toThrow('exactly 1 yoctoNEAR');
    expect(() => checkRelayPolicy(signed({ maxBlockHeight: 1000n }), ctx())).toThrow('expired');
    expect(() => checkRelayPolicy(signed({ maxBlockHeight: 1301n }), ctx())).toThrow('too long');
  });
  it('refuses mainnet senders', () => {
    expect(() => checkRelayPolicy(signed({ senderId: 'riya.near' }), ctx())).toThrow('testnet accounts only');
  });
  it(`enforces ${RELAY_LIMITS.perUserPerDay} relays per shopper per UTC day, a global cap and one in-flight relay per invoice`, () => {
    const row = (i: number, who = sender, at = now): RelayRecord => ({ hash: String(i), sender: who, invoiceId: '0x' + String(i).padStart(64, '0'), relayer: 'relayer.testnet', at, status: 'sent' });
    const mine = Array.from({ length: RELAY_LIMITS.perUserPerDay }, (_, i) => row(i));
    expect(() => checkRelayPolicy(signed(), ctx(mine))).toThrow('Gasless limit reached');
    expect(() => checkRelayPolicy(signed(), ctx(mine.map(r => ({ ...r, at: now - 86400 }))))).not.toThrow();
    const everyone = Array.from({ length: RELAY_LIMITS.globalPerDay }, (_, i) => row(i, `u${i}.testnet`));
    expect(() => checkRelayPolicy(signed(), ctx(everyone))).toThrow("today's limit");
    expect(() => checkRelayPolicy(signed(), ctx([{ ...row(1, 'other.testnet'), invoiceId, status: 'pending' }]))).toThrow('already in flight');
  });
  it('rejects a signature from another key and any edit after signing', () => {
    const w = signed();
    expect(() => rebuildSigned({ ...w, publicKey: KeyPair.fromRandom('ed25519').getPublicKey().toString() })).toThrow('does not verify');
    const edited = { ...w, actions: [{ ...w.actions[0], args: b64(JSON.stringify({ receiver_id: payout, amount: '12000001', memo: `noren:${invoiceId}` })) }] };
    expect(() => rebuildSigned(edited)).toThrow('does not verify');
    expect(() => rebuildSigned({ ...w, maxBlockHeight: '1119' })).toThrow('does not verify');
  });
});

describe('merchant service relay route', () => {
  async function setup(sendOk = true, fullAccess = true, usdcBalance = '500000000') {
    const sent: string[] = [];
    const key = KeyPair.fromRandom('ed25519');
    const relayer = { accountId: 'relayer.noren.testnet', height: async () => 1000n, accessKey: async () => ({ nonce: 3n, fullAccess }), send: async () => { sent.push('x'); return { hash: 'H'.repeat(44), ok: sendOk }; } };
    const txv = { value: null as any, asked: [] as string[] };
    const s = createMerchantService({ file: null, relayer, view: async () => usdcBalance, tx: async (_h: string, account: string) => { txv.asked.push(account); return txv.value; } });
    const order = await s.handle('/shop/checkout', 'POST', { lines: [{ slug: 'amelie-gingham', size: 'S', qty: 1 }] }, '', 'localhost:5395');
    const id = order.checkoutUrl.split('/').at(-1)!;
    const inv = await s.handle(`/invoices/${id}`, 'GET', {}, '', 'localhost:5395');
    const w = (over = {}) => { const x = signed({ args: { receiver_id: DEMO_SHOP, amount: inv.invoice.amount, memo: `noren:${id}` }, ...over }, key); return x; };
    return { s, id, w, sent, inv, txv };
  }
  it('reports its relayer and limits, and relays a valid signed payment once', async () => {
    const { s, id, w, sent } = await setup();
    const st = await s.handle('/relay', 'GET', {}, '', 'localhost:5395');
    expect(st).toMatchObject({ ready: true, relayer: 'relayer.noren.testnet', limits: { perUserPerDay: RELAY_LIMITS.perUserPerDay } });
    const r = await s.handle('/relay', 'POST', { invoiceId: id, delegate: w() }, '', 'localhost:5395');
    expect(r).toMatchObject({ relayer: 'relayer.noren.testnet', sender, usedToday: 1 });
    expect(sent).toHaveLength(1);
  });
  it('refuses a stale nonce and a function-call key before spending gas', async () => {
    const { s, id, w, sent } = await setup();
    await expect(s.handle('/relay', 'POST', { invoiceId: id, delegate: w({ nonce: 3n }) }, '', 'localhost:5395')).rejects.toThrow('already used');
    const fc = await setup(true, false);
    await expect(fc.s.handle('/relay', 'POST', { invoiceId: fc.id, delegate: fc.w() }, '', 'localhost:5395')).rejects.toThrow('full-access key');
    expect(sent).toHaveLength(0);expect(fc.sent).toHaveLength(0);
  });
  // Shape of a real relayed FINAL result (tx 5e7AGM8b… on NEAR testnet): outer Delegate signed by the relayer.
  const delegateTx = (id: string, amount: string, signer = 'relayer.noren.testnet', innerSender = sender) => ({ final_execution_status: 'FINAL', status: { SuccessValue: '' },
    transaction: { signer_id: signer, receiver_id: innerSender, actions: [{ Delegate: { delegate_action: { sender_id: innerSender, receiver_id: USDC, actions: [{ FunctionCall: { method_name: 'ft_transfer', args: b64(JSON.stringify({ receiver_id: DEMO_SHOP, amount, memo: `noren:${id}` })), gas: 15e12, deposit: '1' } }] } } }] },
    receipts_outcome: [{ outcome: { executor_id: sender, status: { SuccessValue: '' } } }, { outcome: { executor_id: USDC, status: { SuccessValue: '' }, logs: [] } }] });
  it('verifies a relayed receipt through the relayer and records who paid the gas', async () => {
    const { s, id, w, inv, txv } = await setup();
    const r = await s.handle('/relay', 'POST', { invoiceId: id, delegate: w() }, '', 'localhost:5395');
    txv.value = delegateTx(id, inv.invoice.amount);
    const paid = await s.handle(`/invoices/${id}/complete`, 'POST', { hash: r.hash, accountId: sender }, '', 'localhost:5395');
    expect(paid).toMatchObject({ status: 'paid', method: 'usdc', gasPaidBy: 'relayer.noren.testnet' });
    expect(txv.asked).toEqual(['relayer.noren.testnet']);
  });
  it('refuses a Delegate receipt this relayer did not submit, or one whose inner transfer failed', async () => {
    const { s, id, inv, txv } = await setup();
    txv.value = delegateTx(id, inv.invoice.amount, 'someone-else.testnet');
    await expect(s.handle(`/invoices/${id}/complete`, 'POST', { hash: 'Q'.repeat(44), accountId: sender }, '', 'localhost:5395')).rejects.toThrow('Relayed payment signer');
    const b = await setup(); const r = await b.s.handle('/relay', 'POST', { invoiceId: b.id, delegate: b.w() }, '', 'localhost:5395');
    const failed = delegateTx(b.id, b.inv.invoice.amount); failed.receipts_outcome[1].outcome.status = { Failure: { ActionError: {} } } as any;
    b.txv.value = failed;
    await expect(b.s.handle(`/invoices/${b.id}/complete`, 'POST', { hash: r.hash, accountId: sender }, '', 'localhost:5395')).rejects.toThrow('FINAL');
  });
  it('refuses a shopper without enough test USDC before spending gas', async () => {
    const { s, id, w, sent } = await setup(true, true, '1000');
    await expect(s.handle('/relay', 'POST', { invoiceId: id, delegate: w() }, '', 'localhost:5395')).rejects.toThrow('Not enough test USDC');
    expect(sent).toHaveLength(0);
  });
  it('says Setup required when no relayer account is configured', async () => {
    const s = createMerchantService({ file: null, relayer: null });
    expect((await s.handle('/relay', 'GET', {}, '', 'localhost:5395')).ready).toBe(false);
    await expect(s.handle('/relay', 'POST', { invoiceId: '0x1', delegate: {} }, '', 'localhost:5395')).rejects.toThrow('Setup required');
  });
  it('marks a relay that failed on chain and does not count it as paid', async () => {
    const { s, id, w } = await setup(false);
    await expect(s.handle('/relay', 'POST', { invoiceId: id, delegate: w() }, '', 'localhost:5395')).rejects.toThrow('failed on NEAR testnet');
    expect((await s.handle(`/invoices/${id}`, 'GET', {}, '', 'localhost:5395')).status).toBe('open');
  });
});
