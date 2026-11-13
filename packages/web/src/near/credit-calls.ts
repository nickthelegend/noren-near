// Shared by the browser and scripts/near-wallet-cycle.mjs. Amounts are raw token units, never floats.
export type CreditAction = 'deposit' | 'borrow' | 'repay' | 'withdraw';
export type Contracts = { credit: string; collateral: string; usdc: string };
export type Call = { receiverId: string; methodName: string; args: Record<string, unknown>; gas: string; deposit: string };
export const STORAGE_DEPOSIT = '1250000000000000000000';
export const accountValid = (s: string) => s.length >= 2 && s.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(s);
export function tokenUnits(value: string, decimals: number): string {
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(value)) throw Error(`Enter a positive amount with at most ${decimals} decimals.`);
  const [whole, fraction = ''] = value.split('.');
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
  if (raw <= 0n || raw > 2n ** 128n - 1n) throw Error('Enter a positive amount within the token limit.');
  return raw.toString();
}
export function creditCall(action: CreditAction, c: Contracts, amount: string, account: string, recipient = account): Call {
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n || BigInt(amount) > 2n ** 128n - 1n) throw Error('Enter a positive token amount.');
  if (![account, recipient, c.credit, c.collateral, c.usdc].every(accountValid)) throw Error('Check the NEAR account name.');
  if (![c.credit, c.collateral, c.usdc].every(x => x.endsWith('.testnet'))) throw Error('Noren wallet actions are testnet only.');
  const gas = '80000000000000';
  if (action === 'deposit' || action === 'repay') return { receiverId: action === 'deposit' ? c.collateral : c.usdc, methodName: 'ft_transfer_call', args: { receiver_id: c.credit, amount, msg: JSON.stringify({ kind: action === 'deposit' ? 'collateral' : 'repay' }) }, gas, deposit: '1' };
  return { receiverId: c.credit, methodName: action === 'borrow' ? 'borrow' : 'withdraw', args: action === 'borrow' ? { amount, recipient } : { token: c.collateral, amount, recipient: account }, gas: action === 'withdraw' ? '60000000000000' : gas, deposit: '0' };
}
export const storageCall = (token: string, account: string): Call => ({ receiverId: token, methodName: 'storage_deposit', args: { account_id: account, registration_only: true }, gas: '10000000000000', deposit: STORAGE_DEPOSIT });
export function mintCall(token: string, account: string): Call {
  if (!['wbtc.fakes.testnet', 'usdc.fakes.testnet'].includes(token)) throw Error('Only the public fake test tokens can be minted here.');
  return { receiverId: token, methodName: 'mint', args: { account_id: account, amount: token === 'wbtc.fakes.testnet' ? '10000' : '200000000' }, gas: '20000000000000', deposit: '0' };
}
export function walletError(e: unknown): string {
  const obj = e as { message?: string; type?: string };
  const text = typeof e === 'string' ? e : `${obj?.type ?? ''} ${obj?.message ?? JSON.stringify(e ?? '')}`;
  if (/popup.*(?:block|failed)|open popup window/i.test(text)) return 'Your browser blocked the wallet window. Allow pop-ups for this site and try again.';
  if (/User closed the window|didn't complete the action|reject|denied|cancel/i.test(text)) return 'You closed the wallet without approving. Nothing new was sent. Try again when ready.';
  if (/No Meteor.*account/i.test(text)) return 'Meteor Wallet has no testnet account yet. Create one in Meteor and connect again.';
  if (/ERR_STALE_PRICE/.test(text)) return 'A collateral price is stale. Ask the operator to refresh the price for each collateral asset with pnpm near:relay and pnpm near:stock-prices. Stock borrowing is paused outside regular US market hours or when the original quote is older than 90 seconds. Yahoo Finance is the no-key source; Pyth requires operator authorization.';
  if (/NotEnoughBalance|insufficient.*balance|not.*enough.*balance|LackBalanceForState/i.test(text)) return 'Insufficient testnet NEAR for gas or storage. Top up your wallet and try again.';
  if (/TOKEN_BALANCE/.test(text)) return 'Insufficient test token balance. Lower the amount or obtain test tokens first.';
  if (/ERR_LTV|ERR_HEALTH/.test(text)) return 'This would exceed your credit limit. Repay some debt or add collateral first.';
  if (/ERR_MARKET_LIQUIDITY/.test(text)) return 'The separate test USDC stock buyer cannot cover this sale. Lower the amount or ask the operator to fund it.';
  if (/ERR_SLIPPAGE/.test(text)) return 'The stock quote changed. Refresh the price and review the amount before trying again.';
  if (/ERR_LIQUIDITY/.test(text)) return 'The test USDC pool cannot cover this payment. Lower the amount.';
  if (/ERR_PENDING/.test(text)) return 'An earlier action is still settling. Check its transaction before trying again.';
  if (/ERR_COLLATERAL/.test(text)) return 'You do not have that much collateral to withdraw.';
  if (/NotEnoughAllowance|allowance/i.test(text)) return 'The wallet signing allowance is used up. Sign out and reconnect with Meteor.';
  if (/UNKNOWN_ACCOUNT|NETWORK_MISMATCH/.test(text)) return 'This account is not on NEAR testnet. Switch to a funded testnet account in Meteor.';
  if (/timeout|fetch|HTTP|RPC|unreachable/i.test(text)) return 'NEAR testnet could not confirm the request. Check the transaction link before trying again.';
  // Deliberate local validation messages are safe to show. Provider dumps are not.
  if (/^(Enter |Check |Connect |Noren |Only |Your |No debt|Token transfer|Transaction|Account changed)/.test(obj?.message ?? '')) return obj.message!.slice(0, 220);
  return 'The action did not complete. Check your wallet and any transaction link before trying again.';
}
export type Outcome = { transaction?: { hash?: string }; transaction_outcome?: { id?: string }; status?: { Failure?: unknown; SuccessValue?: string }; receipts_outcome?: { outcome?: { status?: { Failure?: unknown } } }[]; final_execution_status?: string };
export function verifyOutcome(result: Outcome, call: Call) {
  if (result.status?.Failure) throw Error(JSON.stringify(result.status.Failure));
  const value = result.status?.SuccessValue === undefined ? undefined : JSON.parse(atob(result.status.SuccessValue) || 'null');
  if (['borrow', 'withdraw', 'pay_installment'].includes(call.methodName) && value !== true) throw Error('Token transfer did not complete; the contract restored your balance. Check the transaction link.');
  if (call.methodName === 'ft_transfer_call' && (typeof value !== 'string' || BigInt(value) <= 0n)) throw Error('Token transfer was refunded. Check the transaction link before trying again.');
  if (call.methodName === 'ft_transfer_call' && ['collateral', 'stock_pay'].includes(JSON.parse(String(call.args.msg)).kind) && value !== call.args.amount) throw Error('Token transfer was not fully accepted. Check the transaction link.');
}
