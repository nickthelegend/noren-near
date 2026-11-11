import { nearView } from '@noren/near-sdk';
import { creditCall, mintCall, storageCall, verifyOutcome, type Call, type Contracts, type CreditAction, type Outcome } from './credit-calls.ts';
export async function testnetRpc<T>(method: string, params: object): Promise<T> {
  const r = await fetch('https://test.rpc.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'noren-wallet', method, params }), signal: AbortSignal.timeout(15000) });
  const j = await r.json(); if (!r.ok || j.error) throw Error(`RPC ${JSON.stringify(j.error ?? r.status)}`); return j.result as T;
}
export type Event = { state: 'approval' | 'pending' | 'final'; call: Call; hash?: string };
export type Adapter = { account: string; sign: (call: Call) => Promise<Outcome | undefined>; onEvent?: (event: Event) => void };
export async function confirmCall(call: Call, a: Adapter) {
  a.onEvent?.({ state: 'approval', call });
  let result: Outcome | undefined;
  try { result = await a.sign(call); }
  catch (e) {
    const x = e as Outcome & { context?: { transactionHash?: string }; message?: string };
    const hash = x.transaction_outcome?.id ?? x.context?.transactionHash ?? x.message?.match(/Transaction (\w{43,44}) doesn't exist/)?.[1];
    if (!hash) throw e;
    result = { transaction: { hash } };
  }
  const hash = result?.transaction?.hash ?? result?.transaction_outcome?.id;
  if (!hash) throw Error('Transaction hash was not returned. Check Meteor activity before trying again.');
  a.onEvent?.({ state: 'pending', call, hash });
  // Always observe FINAL, including all callbacks; wallet submission alone is not success.
  const deadline = Date.now() + 60000;
  for (;;) {
    try {
      const final = await testnetRpc<Outcome>('tx', { tx_hash: hash, sender_account_id: a.account, wait_until: 'NONE' });
      if (final.final_execution_status === 'FINAL') { verifyOutcome(final, call); a.onEvent?.({ state: 'final', call, hash }); return { hash, outcome: final }; }
    } catch (e) {
      if (!/RPC|timeout|fetch/i.test(String((e as Error).message))) throw e;
    }
    if (Date.now() >= deadline) throw Error('Transaction is still pending. Check the NearBlocks link before trying again.');
    await new Promise(r => setTimeout(r, 1000));
  }
}
export async function runCreditAction(action: CreditAction | 'faucet', c: Contracts, amount: string, recipient: string, a: Adapter) {
  if (!a.account || a.account.endsWith('.near')) throw Error('Connect a NEAR testnet wallet first.');
  const acct = await testnetRpc<{ amount: string; storage_usage: number }>('query', { request_type: 'view_account', finality: 'final', account_id: a.account });
  const token = action === 'deposit' || action === 'withdraw' ? c.collateral : c.usdc;
  let calls: Call[];
  if (action === 'faucet') {
    calls = [mintCall(recipient, a.account)]; // recipient is the explicitly selected fake token in this branch.
    if (!await nearView(recipient, 'storage_balance_of', { account_id: a.account })) calls.unshift(storageCall(recipient, a.account));
  } else {
    const call = creditCall(action, c, amount, a.account, recipient);
    if (action === 'deposit' || action === 'repay') {
      const balance = await nearView<string>(token, 'ft_balance_of', { account_id: a.account });
      if (BigInt(balance) < BigInt(amount)) throw Error('TOKEN_BALANCE');
    }
    const p = await nearView<{ prices_fresh: boolean; available_usd6: string; debt_usd6: string; collateral: { token: string; amount: string }[] }>(c.credit, 'position', { borrower: a.account });
    if ((action === 'borrow' || (action === 'withdraw' && BigInt(p.debt_usd6) > 0n)) && !p.prices_fresh) throw Error('ERR_STALE_PRICE');
    if (action === 'borrow' && BigInt(amount) > BigInt(p.available_usd6)) throw Error('ERR_LTV');
    if (action === 'repay' && BigInt(p.debt_usd6) === 0n) throw Error('No debt to repay for this wallet.');
    if (action === 'withdraw' && BigInt(amount) > BigInt(p.collateral.find(x => x.token === c.collateral)?.amount ?? '0')) throw Error('ERR_COLLATERAL');
    calls = [call];
    if (action === 'borrow' || action === 'withdraw') {
      await testnetRpc('query', { request_type: 'view_account', finality: 'final', account_id: recipient });
      const target = action === 'borrow' ? recipient : a.account;
      if (!await nearView(token, 'storage_balance_of', { account_id: target })) calls.unshift(storageCall(token, target));
    }
  }
  // Storage reserve plus conservative wallet prepaid-gas coverage (not the actual gas charged).
  const usable = BigInt(acct.amount) - BigInt(acct.storage_usage) * 10n ** 19n;
  const upfront = calls.reduce((max, x) => { const n = BigInt(x.deposit) + BigInt(x.gas) * 10n ** 9n + 10n ** 21n; return n > max ? n : max; }, 0n);
  if (usable < upfront) throw Error('NotEnoughBalance');
  const results = [];
  for (const call of calls) results.push(await confirmCall(call, a));
  return results;
}
