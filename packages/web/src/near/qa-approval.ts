// The QA test wallet's "Approve transaction" sheet. A real wallet (Meteor) shows its own popup; the QA signer is the
// stand-in used for filming and browser QA, so it shows the same decision before anything is signed. It is imported
// only by qa-signer.ts, which is lazy-loaded by a QA-mode build, so it never ships in the production bundle.
import { COLLATERALS, RECORD } from './data';

export type ApprovalRequest = { accountId: string; receiverId: string; methodName: string; args: Record<string, unknown>; gas: string; deposit: string; gasless?: boolean };
export type ApprovalRow = { k: string; v: string; strong?: boolean };

const trim = (s: string) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
export function units(raw: unknown, decimals: number, min = 2): string {
  const n = BigInt(String(raw ?? '0')), base = 10n ** BigInt(decimals), frac = (n % base).toString().padStart(decimals, '0');
  const out = trim(`${n / base}.${frac}`);
  const [w, f = ''] = out.split('.');
  return f.length >= min ? out : `${w}.${f.padEnd(min, '0')}`;
}
const tokenName = (token: string) => (token === RECORD.accounts.tusdc ? 'test USDC' : COLLATERALS.find(c => c.token === token)?.symbol ?? token);
const tokenDec = (token: string) => (token === RECORD.accounts.tusdc ? 6 : COLLATERALS.find(c => c.token === token)?.decimals ?? 8);
const tgas = (gas: string) => `${trim((Number(BigInt(gas)) / 1e12).toFixed(1))} Tgas`;
const near = (y: string) => (y === '0' ? '0 NEAR' : y === '1' ? '1 yoctoNEAR (required by NEP-141, no NEAR moves)' : `${trim((Number(BigInt(y)) / 1e24).toFixed(5))} NEAR`);

/** Plain-words title and the key argument rows for the calls the app can sign. */
export function describeApproval(r: ApprovalRequest): { title: string; rows: ApprovalRow[] } {
  const a = r.args as Record<string, string>, rows: ApprovalRow[] = [];
  let title = `Call ${r.methodName}`;
  const dec = tokenDec(r.receiverId), name = tokenName(r.receiverId);
  if (r.methodName === 'ft_transfer') {
    title = `Send ${units(a.amount, dec)} ${name}`; rows.push({ k: 'To', v: a.receiver_id, strong: true });
    if (a.memo) rows.push({ k: 'Memo', v: String(a.memo) });
  } else if (r.methodName === 'ft_transfer_call') {
    let msg: Record<string, string> = {}; try { msg = JSON.parse(a.msg); } catch { /* shown as-is below */ }
    if (msg.kind === 'collateral') { title = `Lock ${units(a.amount, dec, 1)} ${name} as collateral`; rows.push({ k: 'Into', v: a.receiver_id + ' (credit line)', strong: true }); }
    else if (msg.kind === 'repay') { title = `Repay ${units(a.amount, dec)} ${name}`; rows.push({ k: 'To', v: a.receiver_id + ' (credit line)', strong: true }); }
    else if (msg.kind === 'stock_pay') { title = `Sell ${units(a.amount, dec, 1)} ${name} to pay`; rows.push({ k: 'Shop gets at least', v: `${units(msg.min_usdc, 6)} test USDC`, strong: true }, { k: 'Shop', v: msg.recipient }); }
    else { title = `Send ${units(a.amount, dec)} ${name} with a message`; rows.push({ k: 'To', v: a.receiver_id }); }
  } else if (r.methodName === 'borrow') {
    title = `Borrow ${units(a.amount, 6)} test USDC on credit`; rows.push({ k: 'Paid to', v: a.recipient, strong: true }, { k: 'Backed by', v: 'your locked collateral' });
    if (a.invoice_id) rows.push({ k: 'Invoice', v: a.invoice_id.slice(0, 10) + '…' });
  } else if (r.methodName === 'schedule_pay_in_3') {
    title = `Schedule ${units(a.total, 6)} test USDC in 3 parts`; rows.push({ k: 'Shop', v: a.recipient, strong: true }, { k: 'Pays', v: 'nothing now; each part is a separate approval' });
  } else if (r.methodName === 'pay_installment') {
    title = `Draw instalment ${a.id} from credit`; rows.push({ k: 'Pays', v: 'one part of the schedule to the shop', strong: true });
  } else if (r.methodName === 'withdraw') {
    title = `Withdraw ${units(a.amount, tokenDec(a.token), 1)} ${tokenName(a.token)}`; rows.push({ k: 'Back to', v: a.recipient, strong: true });
  } else if (r.methodName === 'mint') { title = `Mint ${units(a.amount, dec)} ${name}`; rows.push({ k: 'To', v: a.account_id }); }
  else if (r.methodName === 'storage_deposit') { title = 'Register for a token balance'; rows.push({ k: 'For', v: a.account_id }); }
  const head: ApprovalRow[] = [
    { k: 'Network', v: 'NEAR testnet' }, { k: 'Signer', v: r.accountId }, { k: 'Contract', v: r.receiverId }, { k: 'Method', v: r.methodName },
  ];
  const tail: ApprovalRow[] = [{ k: 'Attached', v: near(r.deposit) }, r.gasless ? { k: 'Network fee', v: 'Relayer pays the gas', strong: true } : { k: 'Gas', v: `up to ${tgas(r.gas)}, paid by ${r.accountId}` }];
  return { title, rows: [...head, ...rows, ...tail] };
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Show the sheet and resolve when Approve is clicked; reject when Reject is clicked. */
export function requestApproval(r: ApprovalRequest, doc: Document = document): Promise<void> {
  const { title, rows } = describeApproval(r);
  return new Promise<void>((resolve, reject) => {
    const host = doc.createElement('div'); host.setAttribute('data-qa-approval', ''); host.setAttribute('role', 'dialog'); host.setAttribute('aria-modal', 'true'); host.setAttribute('aria-label', 'Approve transaction');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(16,22,48,.46);backdrop-filter:blur(3px);padding:16px;font:14px/1.4 Inter,system-ui,sans-serif;color:#17203f';
    host.innerHTML = `<div style="width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fffdf9;border-radius:18px;box-shadow:0 30px 80px rgba(10,16,40,.38);border:1px solid rgba(23,32,63,.12)">
<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid rgba(23,32,63,.1);font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6b7390"><span>Test wallet</span><span>NEAR testnet</span></div>
<div style="padding:18px 18px 6px"><div style="font-size:12px;color:#6b7390;margin-bottom:4px">Approve transaction</div><div style="font:600 22px/1.2 Georgia,'Times New Roman',serif;letter-spacing:-.01em">${esc(title)}</div></div>
<dl style="margin:0;padding:6px 18px 8px;display:grid;grid-template-columns:auto 1fr;gap:7px 16px">${rows.map(x => `<dt style="color:#6b7390;white-space:nowrap">${esc(x.k)}</dt><dd style="margin:0;text-align:right;word-break:break-all;font-family:ui-monospace,Menlo,monospace;font-size:13px;${x.strong ? 'font-weight:700;color:#1c2a5e' : ''}">${esc(x.v)}</dd>`).join('')}</dl>
<div style="display:flex;gap:10px;padding:14px 18px 18px"><button data-qa-reject type="button" style="flex:1;min-height:46px;border-radius:12px;border:1px solid rgba(23,32,63,.22);background:#fff;font:600 15px inherit;color:#17203f;cursor:pointer">Reject</button><button data-qa-approve type="button" style="flex:1.4;min-height:46px;border-radius:12px;border:0;background:#1c2a5e;color:#fff;font:600 15px inherit;cursor:pointer">Approve</button></div></div>`;
    const done = (ok: boolean) => () => { host.remove(); ok ? resolve() : reject(Error('Transaction rejected in the test wallet.')); };
    host.querySelector('[data-qa-approve]')!.addEventListener('click', done(true));
    host.querySelector('[data-qa-reject]')!.addEventListener('click', done(false));
    doc.body.append(host);
  });
}
