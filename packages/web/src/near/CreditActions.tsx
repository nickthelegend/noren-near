import { useEffect, useRef, useState } from 'react';
import { nearView } from '@noren/near-sdk';
import type { NearWallet } from './wallet';
import { tokenUnits, type CreditAction } from './credit-calls';
import { COLLATERAL, RECORD, shortHash, units } from './data';
import { Icon } from '../brand';
export type Receipt = { action: string; state: 'approval' | 'pending' | 'final' | 'error'; hashes: string[]; error?: string };
export function CreditReceipt({ receipt }: { receipt: Receipt | null }) {
  if (!receipt) return null;
  return <div className="nc-receipt" role="status" aria-live="polite">
    <div className="nc-receipt-h"><b>{receipt.state === 'approval' ? 'Waiting for Meteor Wallet' : receipt.state === 'pending' ? 'Pending on NEAR testnet…' : receipt.state === 'final' ? 'Final on NEAR testnet' : 'Action not completed'}</b></div>
    {receipt.error && <p className="nk-err" role="alert">{receipt.error}</p>}
    {receipt.state === 'approval' && <p className="nc-fine">Approve any request in Meteor. Previously allowed calls may sign without another popup.</p>}
    {receipt.hashes.map(hash => <a key={hash} className="nk-btn" href={`https://testnet.nearblocks.io/txns/${hash}`} target="_blank" rel="noreferrer">Open {shortHash(hash)} <Icon.ext /></a>)}
  </div>;
}
export type RunAction = (action: CreditAction | 'faucet', amount: string, recipient?: string) => Promise<boolean>;
export function CreditActionSheet({ action, wallet, busy, receipt, run, close }: { action: Exclude<CreditAction, 'borrow'>; wallet: NearWallet; busy: boolean; receipt: Receipt | null; run: RunAction; close: () => void }) {
  const [amount, setAmount] = useState(action === 'repay' ? '0.02' : '0.0001');
  const [balance, setBalance] = useState<string>(), [balanceError, setBalanceError] = useState('');
  const edited = useRef(false);
  const token = action === 'repay' ? RECORD.accounts.tusdc : COLLATERAL, decimals = action === 'repay' ? 6 : 8;
  useEffect(() => {
    if (action === 'deposit' || !wallet.account) return;
    let live = true;
    nearView<{ debt_usd6: string; collateral: { token: string; amount: string }[] }>(RECORD.accounts.credit, 'position', { borrower: wallet.account }).then(p => {
      if (!live || edited.current) return;
      const raw = action === 'repay' ? (BigInt(p.debt_usd6) > 0n ? BigInt(p.debt_usd6) + 1000n : 0n) : BigInt(p.collateral.find(c => c.token === COLLATERAL)?.amount ?? '0');
      const precision = action === 'repay' ? 6 : 8, digits = raw.toString().padStart(precision + 1, '0');
      setAmount(`${digits.slice(0, -precision)}.${digits.slice(-precision)}`);
    }).catch(() => {});
    return () => { live = false; };
  }, [action, wallet.account]);
  useEffect(() => {
    let live = true; setBalance(undefined); setBalanceError('');
    if (wallet.account) nearView<string>(token, 'ft_balance_of', { account_id: wallet.account }).then(b => live && setBalance(b)).catch(() => live && setBalanceError('Could not read the token balance. Try reopening this action.'));
    return () => { live = false; };
  }, [wallet.account, token, receipt?.state]);
  let raw = ''; try { raw = tokenUnits(amount, decimals); } catch { /* Button stays disabled for invalid precision/range. */ }
  const title = action === 'deposit' ? 'Deposit collateral' : action === 'repay' ? 'Repay your credit' : 'Withdraw collateral';
  return <div className="nk-modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.target === e.currentTarget && close()}>
    <div className="nk-sheet">
      <div className="nk-sheet-h"><b>{title}</b><button className="nk-x" onClick={close} aria-label="Close">×</button></div>
      <div style={{ overflowY: 'auto' }}>
        <p className="nc-fine" style={{ overflowWrap: "anywhere" }}>{wallet.account || 'Connect Meteor Wallet to use your own NEAR testnet position.'}</p>
        <div className="nk-box"><label htmlFor="nc-action-amount"><span>Amount in {action === 'repay' ? 'test USDC' : 'test WBTC'}</span></label><input id="nc-action-amount" className="nk-search" inputMode="decimal" value={amount} onChange={e => { edited.current = true; setAmount(e.target.value); }} aria-label={action === 'repay' ? 'Test USDC amount' : 'Test WBTC amount'} /></div>
        <p className="nc-fine">{balance === undefined ? wallet.account ? balanceError || 'Reading your test token balance…' : 'Public test tokens only; no real value.' : `In your wallet: ${units(balance, decimals, decimals)} ${action === 'repay' ? 'test USDC' : 'test WBTC'}.`}</p>
        {wallet.account ? <>
          <button className="nk-cta" disabled={busy || !raw} onClick={() => run(action, raw)}>{busy ? 'Waiting for confirmation…' : title}</button>
          {action !== 'withdraw' && <button className="nk-btn" disabled={busy} onClick={() => run('faucet', '0', token)}>Get test {action === 'repay' ? 'USDC' : 'WBTC'} (no value)</button>}
        </> : <button className="nk-cta" disabled={!wallet.ready || wallet.connecting} onClick={wallet.connect}>{wallet.connecting ? 'Opening Meteor…' : 'Connect Meteor Wallet'}</button>}
        {wallet.error && <p className="nk-err" role="alert">{wallet.error}</p>}
        <CreditReceipt receipt={receipt} />
        <p className="nc-fine">{action === 'repay' ? 'Excess test USDC is refunded by the token contract. Repaying does not need a fresh price.' : action === 'withdraw' ? 'Collateral returns to your connected wallet. Debt must stay within your credit limit.' : 'The token contract transfers collateral to Noren. Meteor may ask to approve test-token storage first.'}</p>
      </div>
    </div>
  </div>;
}
