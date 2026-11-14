import { useEffect, useState } from 'react';
import { Buffer } from 'buffer';
import type { InjectedWallet, WalletSelector } from '@near-wallet-selector/core';
import { CONTRACT } from './data';
import { walletError, type Call, type Outcome } from './credit-calls.ts';
import type { WireDelegate } from './gasless';
export const METEOR = { id: 'meteor-wallet', name: 'Meteor Wallet' } as const;
let selectorPromise: Promise<WalletSelector> | undefined;
function selector() {
  return selectorPromise ??= Promise.all([import('@near-wallet-selector/core'), import('@near-wallet-selector/meteor-wallet')])
    .then(([core, meteor]) => core.setupWalletSelector({ network: 'testnet', modules: [meteor.setupMeteorWallet()] }))
    .catch(e => { selectorPromise = undefined; throw e; });
}
// Both constants are folded by Vite; ordinary production never imports the QA module.
let qaPromise: Promise<ReturnType<typeof import('./qa-signer')['createQaSigner']>> | undefined;
function qaWallet() {
  return qaPromise ??= import('./qa-signer').then(m => m.createQaSigner());
}
async function signingWallet() {
  if (import.meta.env.MODE === 'qa' && import.meta.env.VITE_QA_SIGNER === '1') return qaWallet();
  return (await selector()).wallet<InjectedWallet>(METEOR.id);
}
function ownGasRequested() { try { return sessionStorage.getItem('noren.qa.owngas') === '1'; } catch { return false; } }
export function useNearWallet() {
  const [account, setAccount] = useState('');
  const [ready, setReady] = useState(false), [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, unsubscribe: (() => void) | undefined;
    if (import.meta.env.MODE === 'qa' && import.meta.env.VITE_QA_SIGNER === '1') {
      qaWallet().then(async w => { if (active) { setAccount((await w.getAccounts())[0]?.accountId ?? ''); setReady(true); } }).catch(e => active && setError(walletError(e)));
      return () => { active = false; };
    }
    selector().then(async s => {
      const sync = () => { if (active) setAccount(s.store.getState().accounts.find(a => a.active)?.accountId ?? ''); };
      sync(); const sub = s.store.observable.subscribe(sync); unsubscribe = () => sub.unsubscribe();
      await s.wallet<InjectedWallet>(METEOR.id); // Warm the SDK before the user gesture that opens its popup.
      if (active) setReady(true);
    }).catch(e => active && setError(walletError(e)));
    return () => { active = false; unsubscribe?.(); };
  }, []);
  async function connect() {
    setError(''); setConnecting(true);
    try {
      const w = await signingWallet();
      await w.signIn({ contractId: CONTRACT, methodNames: [] });
      const next = (await w.getAccounts())[0]?.accountId ?? '';
      setAccount(next); return next;
    } catch (e) { setError(walletError(e)); }
    finally { setConnecting(false); }
  }
  async function disconnect() {
    try { await (await signingWallet()).signOut(); setAccount(''); setError(''); }
    catch (e) { setError(walletError(e)); }
  }
  async function sign(call: Call): Promise<Outcome | undefined> {
    const w = await signingWallet();
    const current = (await w.getAccounts())[0]?.accountId;
    if (!account || current !== account) throw Error('Account changed. Reconnect and check your position before signing.');
    const { actionCreators } = await import('@near-wallet-selector/core');
    return await w.signAndSendTransaction({ signerId: account, receiverId: call.receiverId, actions: [actionCreators.functionCall(call.methodName, call.args, BigInt(call.gas), BigInt(call.deposit))] }) as Outcome | undefined;
  }
  async function signMessage(message: string, nonce: string, recipient: string) {
    const w = await signingWallet();
    if (!w.signMessage) throw Error('This wallet does not support NEP-413 message signing.');
    const result = await w.signMessage({message, nonce: Buffer.from(nonce, 'base64'), recipient});
    if (!result) throw Error('You closed the wallet without approving the message.');
    return result;
  }
  // Gasless checkout needs a wallet that signs NEP-366 delegate actions. Meteor's wallet-selector module (10.1.4, the
  // latest) throws "Method not supported" for signDelegateAction, so only the app's own test-key signer offers it.
  const gasless = import.meta.env.MODE === 'qa' && import.meta.env.VITE_QA_SIGNER === '1' && !ownGasRequested(); // QA only: a test run can ask to pay its own gas
  async function signDelegate(call: Call): Promise<WireDelegate> {
    const w = await signingWallet() as unknown as { getAccounts: () => Promise<{ accountId: string }[]>; signDelegate?: (call: Call) => Promise<WireDelegate> };
    const current = (await w.getAccounts())[0]?.accountId;
    if (!account || current !== account) throw Error('Account changed. Reconnect and check your position before signing.');
    if (!gasless || typeof w.signDelegate !== 'function') throw Error('Your wallet cannot sign gasless payments yet. Pay with NEAR for gas instead.');
    return w.signDelegate(call);
  }
  return { account, ready, connecting, error, connect, disconnect, sign, signMessage, gasless, signDelegate };
}
export type NearWallet = ReturnType<typeof useNearWallet>;
