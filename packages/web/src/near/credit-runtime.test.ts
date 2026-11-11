import { afterEach, expect, it, vi } from 'vitest';
import { confirmCall, runCreditAction } from './credit-runtime';
import { creditCall } from './credit-calls';
const c = { credit: 'credit.demo.testnet', collateral: 'wbtc.fakes.testnet', usdc: 'usdc.fakes.testnet' }, account = 'alice.demo.testnet';
const response = (result: unknown) => new Response(JSON.stringify({ result }), { headers: { 'content-type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());
it('does not sign when the borrower price is stale', async () => {
  const sign = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    const q = JSON.parse(options.body);
    if (q.params.request_type === 'view_account') return response({ amount: '1000000000000000000000000', storage_usage: 182 });
    return response({ result: [...new TextEncoder().encode(JSON.stringify({ prices_fresh: false, available_usd6: '1000000', debt_usd6: '0', collateral: [] }))] });
  }));
  await expect(runCreditAction('borrow', c, '10000', 'shop.demo.testnet', { account, sign })).rejects.toThrow('ERR_STALE_PRICE');
  expect(sign).not.toHaveBeenCalled();
});
it('waits for FINAL and keeps the signed transaction hash through pending states', async () => {
  let reads = 0; const events: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async () => response({ final_execution_status: ++reads === 1 ? 'EXECUTED' : 'FINAL', status: { SuccessValue: btoa('true') } })));
  const result = await confirmCall(creditCall('borrow', c, '10000', account), { account, sign: async () => ({ transaction: { hash: 'test-hash' } }), onEvent: e => events.push(e.state) });
  expect(reads).toBe(2); expect(events).toEqual(['approval', 'pending', 'final']); expect(result.hash).toBe('test-hash');
});
it('does not turn a rolled-back merchant payment into a final success', async () => {
  const events: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async () => response({ final_execution_status: 'FINAL', status: { SuccessValue: btoa('false') } })));
  await expect(confirmCall(creditCall('borrow', c, '10000', account), { account, sign: async () => ({ transaction: { hash: 'test-hash' } }), onEvent: e => events.push(e.state) })).rejects.toThrow('restored');
  expect(events).toEqual(['approval', 'pending']);
});
