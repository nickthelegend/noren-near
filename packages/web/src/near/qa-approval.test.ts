import { expect, it } from 'vitest';
import { describeApproval, units } from './qa-approval';
import { CONTRACT, RECORD } from './data';
const account = 'riya.demo.testnet';
it('formats token units', () => { expect(units('12000000', 6)).toBe('12.00'); expect(units('200000000', 8, 1)).toBe('2.0'); expect(units('10000', 8, 1)).toBe('0.0001'); });
it('says who is paid and, for the gasless payment, that the relayer pays the gas', () => {
  const r = describeApproval({ accountId: account, receiverId: RECORD.accounts.tusdc, methodName: 'ft_transfer', args: { receiver_id: 'shop.demo.testnet', amount: '12000000', memo: 'noren:0xabc' }, gas: '15000000000000', deposit: '1', gasless: true });
  expect(r.title).toBe('Send 12.00 test USDC');
  expect(r.rows).toContainEqual({ k: 'Network fee', v: 'Relayer pays the gas', strong: true });
  expect(r.rows).toContainEqual({ k: 'To', v: 'shop.demo.testnet', strong: true });
  expect(r.rows).toContainEqual({ k: 'Network', v: 'NEAR testnet' });
});
it('describes a wallet-paid call with its gas payer', () => {
  const r = describeApproval({ accountId: account, receiverId: CONTRACT, methodName: 'borrow', args: { amount: '49333333', recipient: 'shop.demo.testnet', invoice_id: '0x1234567890abcdef' }, gas: '80000000000000', deposit: '0' });
  expect(r.title).toBe('Borrow 49.333333 test USDC on credit');
  expect(r.rows.at(-1)!.v).toContain('paid by ' + account);
});
