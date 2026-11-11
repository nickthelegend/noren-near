import { useEffect, useState } from 'react';
import type { InjectedWallet, WalletSelector } from '@near-wallet-selector/core';
import { CONTRACT } from './data';
import { walletError, type Call, type Outcome } from './credit-calls.ts';
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
export function useNearWallet() {
  const [account, setAccount] = useState('');
  const [ready, setReady] = useState(false), [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true, unsubscribe: (() => void) | undefined;
    if (import.meta.env.MODE === 'qa' && import.meta.env.VITE_QA_SIGNER === '1') {
      qaWallet().then(() => active && setReady(true)).catch(e => active && setError(walletError(e)));
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
      setAccount((await w.getAccounts())[0]?.accountId ?? '');
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
  return { account, ready, connecting, error, connect, disconnect, sign };
}
export type NearWallet = ReturnType<typeof useNearWallet>;
