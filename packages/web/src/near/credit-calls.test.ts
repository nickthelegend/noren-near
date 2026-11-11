import { describe, expect, it } from 'vitest';
import { creditCall, tokenUnits, verifyOutcome, walletError, mintCall } from './credit-calls';
const c = { credit: 'credit.demo.testnet', collateral: 'wbtc.fakes.testnet', usdc: 'usdc.fakes.testnet' };
const alice = 'alice.demo.testnet', shop = 'shop.demo.testnet';
describe('wallet credit call safety', () => {
  it('keeps token precision and rejects zero, scientific and overflowing amounts', () => {
    expect(tokenUnits('0.00000001', 8)).toBe('1'); expect(tokenUnits('1.000001', 6)).toBe('1000001');
    for (const v of ['0', '-1', '1e3', '1.0000001', '9'.repeat(100)]) expect(() => tokenUnits(v, 6)).toThrow();
  });
  it('routes authenticated deposits and repayments through the correct token contracts', () => {
    const deposit = creditCall('deposit', c, '10000', alice);
    expect(deposit.receiverId).toBe(c.collateral); expect(deposit.methodName).toBe('ft_transfer_call'); expect(deposit.deposit).toBe('1');
    expect(deposit.args).toEqual({ receiver_id: c.credit, amount: '10000', msg: '{"kind":"collateral"}' });
    const repay = creditCall('repay', c, '20000', alice);
    expect(repay.receiverId).toBe(c.usdc); expect(repay.args.msg).toBe('{"kind":"repay"}');
  });
  it('pays the chosen merchant and withdraws only to the signer', () => {
    expect(creditCall('borrow', c, '10000', alice, shop).args).toEqual({ amount: '10000', recipient: shop });
    expect(creditCall('withdraw', c, '10000', alice, shop).args).toEqual({ token: c.collateral, amount: '10000', recipient: alice });
    expect(() => creditCall('borrow', { ...c, credit: 'credit.near' }, '1', alice)).toThrow('testnet only');
    expect(() => mintCall('usdc.near', alice)).toThrow();
  });
  it('does not report a refunded or rolled-back transfer as success', () => {
    const borrow = creditCall('borrow', c, '10000', alice, shop);
    expect(() => verifyOutcome({ status: { SuccessValue: btoa('false') } }, borrow)).toThrow('restored');
    const deposit = creditCall('deposit', c, '10000', alice);
    expect(() => verifyOutcome({ status: { SuccessValue: btoa('"0"') } }, deposit)).toThrow('refunded');
    expect(() => verifyOutcome({ status: { SuccessValue: btoa('"10000"') } }, deposit)).not.toThrow();
  });
  it('explains actual Meteor SDK popup errors and contract/balance failures', () => {
    expect(walletError(Error("Couldn't open popup window to complete wallet action"))).toContain('blocked');
    expect(walletError(Error('Popup window failed to open'))).toContain('blocked');
    expect(walletError(Error('User closed the window before completing the action'))).toContain('closed');
    expect(walletError(Error("didn't complete the action"))).toContain('closed');
    expect(walletError(Error('ERR_STALE_PRICE'))).toContain('pnpm near:relay');
    expect(walletError({ type: 'NotEnoughBalance' })).toContain('Insufficient testnet NEAR');
  });
});
