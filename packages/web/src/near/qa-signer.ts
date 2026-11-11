// Deliberately lazy-loaded only by a QA-mode build. Never store or log injected credentials.
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, type KeyPairString } from 'near-api-js';
import type { InjectedWallet } from '@near-wallet-selector/core';
import { CONTRACT, RECORD } from './data';
import { accountValid } from './credit-calls';

export const QA_SIGNER_MODULE = 'noren-qa-signer';
export type QaConfig = { accountId: string; privateKey: string; rpcUrl: string };
type Request = Parameters<InjectedWallet['signAndSendTransaction']>[0];
type Reservation = { receiverId: string; gas: string; deposit: string };
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
  if (!request.receiverId?.endsWith('.testnet') || ![CONTRACT, RECORD.accounts.tbtc, RECORD.accounts.tusdc].includes(request.receiverId)) throw Error('QA signer refuses this receiver.');
  if (request.actions.length !== 1) throw Error('QA signer accepts one function call per transaction.');
  const action = request.actions[0];
  if (action.enum !== 'functionCall' || !action.functionCall) throw Error('QA signer accepts function calls only.');
  const { methodName, args, gas, deposit } = action.functionCall;
  const allowed = request.receiverId === CONTRACT ? ['borrow', 'withdraw'] : ['ft_transfer_call', 'storage_deposit', 'mint'];
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
  const accountId = config.accountId;
  config.privateKey = ''; // The SDK's signer is the only remaining owner in the page.
  let connected = false, signing = false;
  const getAccounts = async () => connected ? [{ accountId }] : [];
  const signAndSendTransaction = async (request: Request) => {
    if (!connected || signing) throw Error('QA signer is disconnected or already signing.');
    const reservation = assertQaTransaction(request, accountId);
    signing = true;
    try {
      await window.__norenQaAuthorize!(reservation);
      // No retries here: the shared app pipeline observes the returned hash through FINAL.
      return await signer.signAndSendTransaction({ receiverId: reservation.receiverId, actions: request.actions, waitUntil: 'INCLUDED', throwOnFailure: false });
    } catch { throw Error('QA signer transaction failed. Check testnet activity before retrying.'); }
    finally { signing = false; }
  };
  return {
    id: QA_SIGNER_MODULE,
    getAccounts,
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
