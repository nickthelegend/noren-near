import { expect, it } from 'vitest';
import { actionCreators } from '@near-wallet-selector/core';
import { assertQaNetwork, assertQaTransaction } from './qa-signer';
import { CONTRACT, RECORD } from './data';
const account = 'alice.demo.testnet';
it('restricts the QA signer to a loopback page, named testnet account and exact testnet RPC', () => {
  const config = { accountId: account, rpcUrl: 'https://test.rpc.fastnear.com' };
  expect(() => assertQaNetwork(config, '127.0.0.1')).not.toThrow();
  for (const accountId of ['alice.near', 'a'.repeat(64), 'alice.testnet.evil', 'bad..testnet']) expect(() => assertQaNetwork({ ...config, accountId }, 'localhost')).toThrow();
  expect(() => assertQaNetwork(config, 'example.com')).toThrow();
  for (const rpcUrl of ['https://rpc.mainnet.near.org', 'https://test.rpc.fastnear.com.evil', 'http://127.0.0.1:3030']) expect(() => assertQaNetwork({ ...config, rpcUrl }, 'localhost')).toThrow();
});
it('refuses other receivers, signers, mainnet arguments, non-call actions and excessive gas/deposit', () => {
  const tx = { signerId: account, receiverId: CONTRACT, actions: [actionCreators.functionCall('borrow', { amount: '10000', recipient: 'shop.demo.testnet' }, 80_000_000_000_000n, 0n)] };
  expect(assertQaTransaction(tx, account).receiverId).toBe(CONTRACT);
  for (const receiverId of ['credit.near', 'other.testnet']) expect(() => assertQaTransaction({ ...tx, receiverId }, account)).toThrow();
  expect(() => assertQaTransaction({ ...tx, signerId: 'other.testnet' }, account)).toThrow();
  const call = (method: string, args: object, gas = 80_000_000_000_000n, deposit = 0n) => ({ ...tx, actions: [actionCreators.functionCall(method, args, gas, deposit)] });
  expect(() => assertQaTransaction(call('borrow', { recipient: 'shop.near' }), account)).toThrow();
  expect(() => assertQaTransaction(call('set_owner', {}), account)).toThrow();
  expect(() => assertQaTransaction(call('borrow', {}, 81_000_000_000_000n), account)).toThrow();
  expect(() => assertQaTransaction(call('borrow', {}, 80_000_000_000_000n, 10n ** 24n), account)).toThrow();
  expect(() => assertQaTransaction({ ...tx, actions: [actionCreators.transfer(1n)] }, account)).toThrow();
  expect(() => assertQaTransaction({ ...tx, receiverId: RECORD.accounts.tbtc, actions: tx.actions }, account)).toThrow();
});
