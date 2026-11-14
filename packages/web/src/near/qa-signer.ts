// Deliberately lazy-loaded only by a QA-mode build. Never store or log injected credentials.
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, type KeyPairString } from 'near-api-js';
import type { InjectedWallet } from '@near-wallet-selector/core';
import { CONTRACT, RECORD, COLLATERALS } from './data';
import { accountValid, type Call } from './credit-calls';
import { GASLESS_GAS, toWire } from './gasless';
import { requestApproval } from './qa-approval';

export const QA_SIGNER_MODULE = 'noren-qa-signer';
export type QaConfig = { accountId: string; privateKey: string; rpcUrl: string; approve?: boolean };
type Request = Parameters<InjectedWallet['signAndSendTransaction']>[0];
type Reservation = { receiverId: string; gas: string; deposit: string; gasless?: boolean };
declare global {
  interface Window {
    __NOREN_QA_SIGNER__?: QaConfig;
    __norenQaAuthorize?: (request: Reservation) => Promise<void>;
  }
}
export function assertQaNetwork(config: Pick<QaConfig, 'accountId' | 'rpcUrl'>, hostname: string) {
  if (!['127.0.0.1', 'localhost'].includes(hostname)) throw Error('QA signer requires a loopback page.');
  if (!accountValid(config.accountId) || !config.accountId.endsWith('.testnet')) throw Error('QA signer requires a named .testnet account.');
  if (config.rpcUrl !== 'https://test.rpc.fastnear.com') throw Error('QA signer refuses non-testnet RPC endpoints.');
}
export function assertQaTransaction(request: Request, accountId: string) {
  if (request.signerId && request.signerId !== accountId) throw Error('QA signer account mismatch.');
  if (!request.receiverId?.endsWith('.testnet') || ![CONTRACT, RECORD.accounts.tusdc, ...COLLATERALS.map(c => c.token)].includes(request.receiverId)) throw Error('QA signer refuses this receiver.');
  if (request.actions.length !== 1) throw Error('QA signer accepts one function call per transaction.');
  const action = request.actions[0];
  if (action.enum !== 'functionCall' || !action.functionCall) throw Error('QA signer accepts function calls only.');
  const { methodName, args, gas, deposit } = action.functionCall;
  const allowed = request.receiverId === CONTRACT ? ['borrow', 'withdraw', 'schedule_pay_in_3', 'pay_installment'] : ['ft_transfer', 'ft_transfer_call', 'storage_deposit', 'mint'];
  if (!allowed.includes(methodName) || gas <= 0n || gas > 80_000_000_000_000n || deposit < 0n || deposit > 1_250_000_000_000_000_000_000n) throw Error('QA signer refuses this method or gas/deposit limit.');
  let values: Record<string, unknown>;
  try { values = JSON.parse(new TextDecoder().decode(args)); } catch { throw Error('QA signer requires JSON function arguments.'); }
  for (const field of ['receiver_id', 'recipient', 'account_id', 'token']) {
    if (values[field] !== undefined && (typeof values[field] !== 'string' || !accountValid(values[field]) || !values[field].endsWith('.testnet'))) throw Error('QA signer refuses non-testnet argument accounts.');
  }
  return { receiverId: request.receiverId, gas: gas.toString(), deposit: deposit.toString() };
}
export function createQaSigner() {
  if (import.meta.env.MODE !== 'qa' || import.meta.env.VITE_QA_SIGNER !== '1') throw Error('QA signer is disabled in this build.');
  const config = window.__NOREN_QA_SIGNER__;
  delete window.__NOREN_QA_SIGNER__;
  if (!config) throw Error('QA signer requires an in-memory test injection.');
  assertQaNetwork(config, location.hostname);
  if (!window.__norenQaAuthorize) throw Error('QA signer requires the test budget guard.');
  let signer: Account;
  try { signer = new Account(config.accountId, new JsonRpcProvider({ url: config.rpcUrl }), new KeyPairSigner(KeyPair.fromString(config.privateKey as KeyPairString))); }
  catch { throw Error('QA signer could not load the injected test key.'); }
  const accountId = config.accountId, approve = config.approve === true; // approve: show the test wallet's Approve sheet before every signature
  const ask = async (request: Request, extra: { gasless?: boolean } = {}) => {
    if (!approve) return;
    const fc = request.actions[0].functionCall!, values = JSON.parse(new TextDecoder().decode(fc.args));
    await requestApproval({ accountId, receiverId: request.receiverId, methodName: fc.methodName, args: values, gas: fc.gas.toString(), deposit: fc.deposit.toString(), ...extra });
  };
  config.privateKey = ''; // The SDK's signer is the only remaining owner in the page.
  let connected = false, signing = false;
  const getAccounts = async () => connected ? [{ accountId }] : [];
  const signAndSendTransaction = async (request: Request) => {
    if (!connected || signing) throw Error('QA signer is disconnected or already signing.');
    const reservation = assertQaTransaction(request, accountId);
    signing = true;
    try {
      await ask(request);
      await window.__norenQaAuthorize!(reservation);
      // No retries here: the shared app pipeline observes the returned hash through FINAL.
      return await signer.signAndSendTransaction({ receiverId: reservation.receiverId, actions: request.actions, waitUntil: 'INCLUDED', throwOnFailure: false });
    } catch { throw Error('QA signer transaction failed. Check testnet activity before retrying.'); }
    finally { signing = false; }
  };
  // NEP-366: sign a DelegateAction for one gasless test-USDC payment; Noren's relayer submits it and pays the gas.
  const signDelegate = async (call: Call) => {
    if (!connected || signing) throw Error('QA signer is disconnected or already signing.');
    const delegated = { signerId: accountId, receiverId: call.receiverId, actions: [{ enum: 'functionCall', functionCall: { methodName: call.methodName, args: new TextEncoder().encode(JSON.stringify(call.args)), gas: BigInt(call.gas), deposit: BigInt(call.deposit) } }] } as unknown as Request;
    const reservation = assertQaTransaction(delegated, accountId);
    if (call.receiverId !== RECORD.accounts.tusdc || call.methodName !== 'ft_transfer' || BigInt(call.gas) > BigInt(GASLESS_GAS) || call.deposit !== '1') throw Error('QA signer signs gasless test-USDC payments only.');
    signing = true;
    try {
      await ask(delegated, { gasless: true });
      await window.__norenQaAuthorize!({ ...reservation, gasless: true });
      const r = await signer.createSignedMetaTransaction({ receiverId: call.receiverId, actions: [actions.functionCall(call.methodName, call.args, BigInt(call.gas), BigInt(call.deposit))], blockHeightTtl: 120 });
      return toWire(r.signedDelegate);
    } catch { throw Error('QA signer could not sign the gasless payment.'); }
    finally { signing = false; }
  };
  return {
    id: QA_SIGNER_MODULE,
    signDelegate,
    getAccounts,
    signMessage: async (payload: {message:string;nonce:Uint8Array;recipient:string}) => {
      if (!connected || payload.recipient !== location.host || !payload.message.startsWith('Sign in to Noren Merchant on NEAR testnet.')) throw Error('QA signer refuses this sign-in message.');
      const { signMessage } = await import('near-api-js/nep413');
      const r = await signMessage({signerAccount: signer, payload});
      return { accountId, publicKey: r.publicKey.toString(), signature: btoa(String.fromCharCode(...r.signature)) };
    },
    signIn: async ({ contractId }: { contractId?: string }) => {
      if (contractId !== CONTRACT) throw Error('QA signer refuses another sign-in contract.');
      connected = true; return getAccounts();
    },
    signOut: async () => { connected = false; },
    signAndSendTransaction,
    signAndSendTransactions: async ({ transactions }: { transactions: Request[] }) => {
      const results = [];
      for (const transaction of transactions) results.push(await signAndSendTransaction(transaction));
      return results;
    },
  };
}
