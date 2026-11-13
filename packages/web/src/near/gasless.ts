// Gasless stablecoin checkout (NEP-366). The shopper signs a DelegateAction for one test-USDC ft_transfer bound to the
// invoice; Noren's relayer (packages/merchant/src/relayer.ts) wraps it in a transaction it signs and pays for.
import { RECORD } from './data';
import type { Call } from './credit-calls';
import type { Payment } from './checkout-calls';
import { checkoutCall } from './checkout-calls';

export const GASLESS_GAS = '15000000000000';
/** The browser-to-relayer wire format: DelegateAction fields, args as base64 of the exact signed bytes. */
export type WireDelegate = { senderId: string; receiverId: string; nonce: string; maxBlockHeight: string; publicKey: string; actions: { methodName: string; args: string; gas: string; deposit: string }[]; signature: string };
export type RelayStatus = { ready: boolean; relayer: string | null; missing: string[]; limits: { perUserPerDay: number; globalPerDay: number; maxGas: string } };

/** The same invoice-bound USDC transfer as the wallet-paid path, with the relayer's 15 Tgas cap. */
export function gaslessCall(p: Payment, account: string): Call {
  const c = checkoutCall('usdc', p, account);
  if (c.receiverId !== RECORD.accounts.tusdc) throw Error('Only test USDC payments can be gasless.');
  return { ...c, gas: GASLESS_GAS };
}

const b64 = (bytes: Uint8Array) => { let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); };
type SignedLike = { delegateAction: { senderId: string; receiverId: string; nonce: bigint; maxBlockHeight: bigint; publicKey: { toString(): string }; actions: { functionCall?: { methodName: string; args: Uint8Array; gas: bigint; deposit: bigint } }[] }; signature: { data: Uint8Array } };
export function toWire(s: SignedLike): WireDelegate {
  const d = s.delegateAction;
  return {
    senderId: d.senderId, receiverId: d.receiverId, nonce: String(d.nonce), maxBlockHeight: String(d.maxBlockHeight), publicKey: d.publicKey.toString(),
    actions: d.actions.map(a => { if (!a.functionCall) throw Error('Gasless payments carry one function call.'); const f = a.functionCall; return { methodName: f.methodName, args: b64(f.args), gas: String(f.gas), deposit: String(f.deposit) }; }),
    signature: b64(s.signature.data),
  };
}
