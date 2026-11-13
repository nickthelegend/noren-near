import { expect, it } from 'vitest';
import { KeyPair, KeyPairSigner, actions, buildDelegateAction } from 'near-api-js';
import { gaslessCall, toWire, GASLESS_GAS } from './gasless';
import { rebuildSigned, checkRelayPolicy } from '../../../merchant/src/relayer';
import { RECORD } from './data';
const p = { id: '0x' + 'c'.repeat(64), amount: '12000000', payout: 'shop.testnet' };
it('builds the invoice-bound test-USDC transfer with the relayer gas cap', () => {
  const c = gaslessCall(p, 'riya.testnet');
  expect(c).toMatchObject({ receiverId: RECORD.accounts.tusdc, methodName: 'ft_transfer', gas: GASLESS_GAS, deposit: '1', args: { receiver_id: p.payout, amount: p.amount, memo: `noren:${p.id}` } });
});
it('sends the browser-signed delegate in a form the relayer verifies byte for byte', async () => {
  const key = KeyPair.fromRandom('ed25519'), c = gaslessCall(p, 'riya.testnet');
  const da = buildDelegateAction({ senderId: 'riya.testnet', receiverId: c.receiverId, nonce: 9n, maxBlockHeight: 1100n, publicKey: key.getPublicKey(), actions: [actions.functionCall(c.methodName, c.args, BigInt(c.gas), BigInt(c.deposit))] });
  const w = toWire((await new KeyPairSigner(key).signDelegateAction(da)).signedDelegate as never);
  expect(() => checkRelayPolicy(w, { invoiceId: p.id, payout: p.payout, remaining: 12_000_000n, height: 1000n, relays: [], now: 1794600000 })).not.toThrow();
  expect(rebuildSigned(w).delegateAction.receiverId).toBe(RECORD.accounts.tusdc);
});
