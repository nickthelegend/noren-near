import { useEffect, useMemo, useRef, useState } from "react";
import { dryQuote, type QuoteResponse } from "@noren/near-sdk";
import { Icon, Logo } from "../ui";
import { Mark } from "../logos";
import { MeltChart } from "./Melt";
import { useNearWallet, type NearWallet } from "./wallet";
import {
  COLLATERAL, CONTRACT, DEMO, HOME_COINS, NEAR_USDC, RECORD, SAVED_QUOTES, ago, explorerAccount, healthLabel, meltCurve, nsToMs,
  short, shortHash, units, usd6, useAssets, usePool, usePosition, useRates, useTokens, type Position,
} from "./data";
import "@fontsource-variable/urbanist";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "../app/app.css";
import "./near.css";

type Tab = "credit" | "pay" | "melt";
const TABS: { k: Tab; l: string }[] = [{ k: "credit", l: "Credit" }, { k: "pay", l: "Pay anyone" }, { k: "melt", l: "Debt-free" }];
const tabFromHash = (): Tab => (/#\/near\/app\/(pay|melt)(?:[/?]|$)/.exec(location.hash)?.[1] as Tab) ?? "credit";
const WBTC_RHEA = "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near";
const n6 = (raw?: string) => raw === undefined ? 0 : Number(BigInt(raw)) / 1e6;
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } } };

export function NearCredit() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => { const onHash = () => setTab(tabFromHash()); addEventListener("hashchange", onHash); return () => removeEventListener("hashchange", onHash); }, []);
  const [account, setAccount] = useState(() => store.get("noren-near-account") || DEMO.open);
  const [picking, setPicking] = useState(false);
  const wallet = useNearWallet();
  useEffect(() => { if (wallet.account) { setAccount(wallet.account); store.set("noren-near-account", wallet.account); } }, [wallet.account]);
  const pos = usePosition(account), pool = usePool(), assets = useAssets(), tokens = useTokens(), rates = useRates();
  const btc = assets.data?.find((a) => a.token === COLLATERAL);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, "", `#/near/app${t === "credit" ? "" : `/${t}`}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const choose = (a: string) => { setAccount(a); store.set("noren-near-account", a); setPicking(false); };

  return (
    <div className="nk nc">
      <header className="nk-nav">
        <a className="nk-brand" href="#/near"><Logo size={30} /><span>Noren</span><small>NEAR</small></a>
        <div className="nk-tabs" role="tablist" aria-label="Noren on NEAR">
          {TABS.map((t) => (
            <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => go(t.k)}>
              {tab === t.k && <span className="nk-tab-pill" aria-hidden />}<span className="nk-tab-l">{t.l}</span>
            </button>
          ))}
        </div>
        <div className="nk-right">
          <span className="nk-net hide-s"><i className={pool.error ? "" : "on"} />NEAR testnet</span>
          <button className="nk-chip" onClick={() => setPicking(true)} aria-label={`Account ${account}. Change account`}><span className="nk-ava" aria-hidden />{short(account)}</button>
        </div>
      </header>

      <main className="nk-main">
        <div className="nk-home">
          <div className="nk-home-main">
            {tab === "credit" && <CreditView account={account} pos={pos} btc={btc} go={go} tokens={tokens} />}
            {tab === "pay" && <PayView account={account} pos={pos.data} tokens={tokens} />}
            {tab === "melt" && <MeltView account={account} pos={pos.data} posError={pos.error} aprBps={pool.data?.aprBps} rates={rates} />}
          </div>
          <aside className="nk-home-side">
            <ContractCard pool={pool} btc={btc} assetsError={assets.error} />
            <Activity account={account} />
          </aside>
        </div>
      </main>
      <p className="nk-foot">NEAR testnet only. Collateral is wbtc.fakes.testnet and the pool is usdc.fakes.testnet, public test tokens with no value that stand in for bridged BTC and NEAR USDC. Mainnet deposits, payouts and harvests: {SAVED_QUOTES.mainnetExecution}. <a href="#/near">About the NEAR edition</a></p>

      {picking && (
        <div className="nk-modal" role="dialog" aria-modal="true" aria-label="Choose a NEAR account" onClick={(e) => e.target === e.currentTarget && setPicking(false)}>
          <div className="nk-sheet">
            <div className="nk-sheet-h"><b>Read any account</b><button className="nk-x" onClick={() => setPicking(false)} aria-label="Close">×</button></div>
            <AccountForm current={account} onPick={choose} wallet={wallet} />
          </div>
        </div>
      )}
    </div>
  );
}

function AccountForm({ current, onPick, wallet }: { current: string; onPick: (a: string) => void; wallet: NearWallet }) {
  const [v, setV] = useState(current);
  const ok = /^[a-z0-9_.-]{2,64}$/.test(v);
  return (
    <form style={{ overflowY: "auto" }} onSubmit={(e) => { e.preventDefault(); if (ok) onPick(v); }}>
      <input className="nk-search" value={v} onChange={(e) => setV(e.target.value.trim().toLowerCase())} placeholder="you.testnet" aria-label="NEAR testnet account" autoFocus />
      <ul className="nk-list">
        {[{ id: DEMO.open, l: "Demo borrower with an open loan" }, { id: DEMO.repaid, l: "Demo borrower who repaid and withdrew" }].map((x) => (
          <li key={x.id}><button type="button" onClick={() => onPick(x.id)} aria-selected={current === x.id}><span className="nk-ava" aria-hidden /><span><b>{x.id.split(".")[0]}</b><small>{x.l}</small></span></button></li>
        ))}
      </ul>
      <button className="nk-cta" disabled={!ok}>Read position</button>
      {wallet.account ? <button type="button" className="nk-btn" onClick={wallet.disconnect}>Sign out of Meteor</button> : <button type="button" className="nk-cta" disabled={!wallet.ready || wallet.connecting} onClick={wallet.connect}>{wallet.connecting ? "Opening Meteor…" : !wallet.ready ? "Loading wallet…" : "Connect Meteor Wallet"}</button>}
      {wallet.error && <p className="nk-err" role="alert">{wallet.error}</p>}
      <p className="nc-fine">{wallet.account ? `Connected: ${wallet.account}. You can still read demo accounts.` : "Read demo positions or connect your own NEAR testnet wallet with Meteor."}</p>
    </form>
  );
}

// ------------------------------------------------------------------ credit
type Live<T> = { data?: T; error?: string; loading: boolean; reload: () => void; at?: number };
function CreditView({ account, pos, btc, go, tokens }: { account: string; pos: Live<Position>; btc?: { price_usd6: string; price_at_ns: string; price_fresh: boolean; ltv_bps: number; liq_bps: number }; go: (t: Tab) => void; tokens: Live<import("@noren/near-sdk").Token[]> }) {
  const p = pos.data;
  const wbtc = p?.collateral.find((c) => c.token === COLLATERAL);
  const debt = n6(p?.debt_usd6), coll = n6(p?.collateral_usd6), limit = n6(p?.credit_limit_usd6);
  return (
    <>
      <section className="nk-hero nc-hero" aria-live="polite">
        <small>Credit limit · Noren on NEAR testnet</small>
        <b><i>$</i>{p ? n6(p.credit_limit_usd6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : pos.error ? "—" : "…"}</b>
        <p>{pos.error ? `Could not read ${short(account)}: ${pos.error}` : !p ? "Reading the position view…" : wbtc
          ? <>{units(wbtc.amount, 8)} test WBTC × {btc ? usd6(btc.price_usd6, 0) : "…"} relayer price × {btc ? btc.ltv_bps / 100 : 50}% LTV</>
          : <>No collateral on Noren for {short(account)} yet.</>}</p>
        <div className="nc-tiles">
          <span><em>Collateral</em>{p ? usd6(p.collateral_usd6) : "—"}</span>
          <span><em>Owed</em>{p ? usd6(p.debt_usd6) : "—"}</span>
          <span><em>Available</em>{p ? usd6(p.available_usd6) : "—"}</span>
          <span><em>Health</em>{p ? healthLabel(p.health_bps) : "—"}</span>
        </div>
      </section>

      {p && coll > 0 && <Meter debt={debt} coll={coll} limit={limit} liqBps={btc?.liq_bps ?? 6000} fresh={p.prices_fresh} />}

      <div className="nk-actions nc-actions">
        <button className="primary" onClick={() => go("pay")}><i><Icon.arrow /></i><b>Pay anyone</b><small>On credit, any chain</small></button>
        <button onClick={() => document.getElementById("coins")?.scrollIntoView({ behavior: "smooth" })}><i><Icon.layers /></i><b>Bring coins</b><small>BTC, ZEC, ETH, SOL</small></button>
        <button onClick={() => go("melt")}><i><Icon.chart /></i><b>Debt-free date</b><small>Yield vs interest</small></button>
        <a href={explorerAccount(account)} target="_blank" rel="noreferrer"><i><Icon.ext /></i><b>Explorer</b><small>{short(account)}</small></a>
      </div>

      <section className="nk-card" id="coins">
        <div className="nk-card-h"><div><b>Your coins on every chain</b><p>Live 1Click mainnet prices. Credit at the contract’s 50% LTV.</p></div><span className="nk-pill live">1Click</span></div>
        <ul className="nc-coins">
          <li className="here">
            <Mark id="BTC" size={36} />
            <span><b>Test WBTC <small className="nk-pill">testnet stand-in</small></b><small className="mono">{COLLATERAL}</small></span>
            <span className="r"><b>{wbtc ? `${units(wbtc.amount, 8)}` : "0"}</b><small>{wbtc ? `${usd6(wbtc.value_usd6)} locked` : "nothing locked"}</small></span>
          </li>
          {HOME_COINS.map((c) => {
            const t = tokens.data?.find((x) => x.symbol === c.symbol && x.blockchain === c.chain);
            return (
              <li key={c.symbol}>
                <Mark id={c.symbol} size={36} />
                <span><b>{c.name}</b><small>{t ? <span className="mono">{t.assetId.replace("nep141:", "")}</span> : tokens.error ?? "Loading…"}</small></span>
                <span className="r"><b>{t?.price ? `$${Math.round(t.price / 2).toLocaleString("en-US")}` : "—"}</b><small>credit per {c.symbol}</small></span>
              </li>
            );
          })}
        </ul>
        <p className="nc-setup"><Icon.lock /> Deposit addresses come from 1Click on mainnet. Setup required: NEAR_MAINNET_ACCOUNT. Shielded ZEC hides where a deposit came from, not the NEAR-side position.</p>
      </section>
    </>
  );
}

function Meter({ debt, coll, limit, liqBps, fresh }: { debt: number; coll: number; limit: number; liqBps: number; fresh: boolean }) {
  const pct = (x: number) => `${Math.min(100, (x / coll) * 100).toFixed(2)}%`;
  return (
    <section className="nk-card nc-meter">
      <div className="nk-card-h"><div><b>How much of your coin is spoken for</b><p>{usd6(BigInt(Math.round(debt * 1e6)))} owed of {usd6(BigInt(Math.round(limit * 1e6)))} limit. Liquidation starts at {liqBps / 100}% of collateral value.</p></div><span className={`nk-pill ${fresh ? "live" : "warn"}`}>{fresh ? "Price fresh" : "Price stale"}</span></div>
      <div className="nc-bar" role="img" aria-label={`Debt is ${((debt / coll) * 100).toFixed(1)}% of collateral value`}>
        <span className="fill" style={{ width: pct(debt) }} />
        <span className="mark ltv" style={{ left: pct(limit) }}><em>Limit</em></span>
        <span className="mark liq" style={{ left: `${liqBps / 100}%` }}><em>Liquidation</em></span>
      </div>
      {!fresh && <p className="nc-fine">The relayer price is older than 90 s, so new borrowing is paused until the next signed post. Repaying always works.</p>}
    </section>
  );
}

// ------------------------------------------------------------------ pay
type Dest = "near" | "base" | "arb";
function PayView({ account, pos, tokens }: { account: string; pos?: Position; tokens: Live<import("@noren/near-sdk").Token[]> }) {
  const [dest, setDest] = useState<Dest>("base");
  const [amount, setAmount] = useState("1");
  const [to, setTo] = useState("");
  const [in3, setIn3] = useState(false);
  const [quote, setQuote] = useState<{ r: QuoteResponse; dest: Dest } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const quoteRequest = useRef(0);
  const clearQuote = () => { quoteRequest.current++; setQuote(null); setErr(""); setBusy(false); };
  useEffect(() => () => { quoteRequest.current++; }, []);
  const amt = Number(amount);
  // USDC has six decimals. Keep installment arithmetic within exact integer units.
  const valid = /^\d+(?:\.\d{1,6})?$/.test(amount) && amt > 0 && Number.isSafeInteger(Math.round(amt * 1e6));
  const avail = n6(pos?.available_usd6);
  const out = tokens.data?.find((t) => t.symbol === "USDC" && t.blockchain === dest);
  const recipientOk = dest === "near" ? /^[a-z0-9_.-]{2,64}$/.test(to) : /^0x[0-9a-fA-F]{40}$/.test(to);
  const paid = RECORD.steps.find((s) => s.step.startsWith("alice pays shop"));
  const schedule = useMemo(() => { if (!valid) return []; const third = Math.floor((amt * 1e6) / 3); return [third, third, Math.round(amt * 1e6) - third * 2].map((v, i) => ({ v, d: new Date(Date.now() + i * 30 * 86_400_000) })); }, [amt, valid]);

  async function getQuote() {
    const request = ++quoteRequest.current;
    setErr(""); setQuote(null); setBusy(true);
    try {
      if (!out) throw new Error(`USDC on ${dest} is not in the live 1Click catalog`);
      const r = await dryQuote({ originAsset: NEAR_USDC, destinationAsset: out.assetId, amount: String(Math.round(amt * 1e6)), recipient: to,
        recipientType: "DESTINATION_CHAIN", refundTo: "intents.near", refundType: "ORIGIN_CHAIN" });
      if (request === quoteRequest.current) setQuote({ r, dest });
    } catch (e) { if (request === quoteRequest.current) setErr(e instanceof Error ? e.message : String(e)); }
    finally { if (request === quoteRequest.current) setBusy(false); }
  }
  const q = quote?.r.quote as { quote?: { amountOutFormatted?: string; amountInFormatted?: string; timeEstimate?: number; amountOutUsd?: string; minAmountOut?: string } } | undefined;
  return (
    <section className="nk-card">
      <div className="nk-card-h"><div><b>Pay anyone, anywhere</b><p>View the testnet merchant payment or get a dry quote to Base or Arbitrum. Browser signing is not built.</p></div><span className="nk-pill">{short(account)}</span></div>
      <div className="nk-band" role="radiogroup" aria-label="Where the merchant gets paid">
        <span>Merchant is on</span>
        {([["near", "NEAR"], ["base", "Base"], ["arb", "Arbitrum"]] as [Dest, string][]).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={dest === k} aria-pressed={dest === k} onClick={() => { setDest(k); clearQuote(); setTo(""); }}>{l}</button>
        ))}
      </div>
      <div className="nk-pad">
        <div className="nk-box" style={{ marginTop: 10 }}>
          <label htmlFor="nc-amt"><span>Amount</span><span className="mono">{pos ? `${usd6(pos.available_usd6)} available` : "—"}</span></label>
          <div className="nk-row"><input id="nc-amt" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); clearQuote(); }} aria-label="Amount in USDC" /><span className="nk-token" data-static="true"><Mark id="USDC" size={28} />USDC</span></div>
          <div className="nk-sub"><span>{dest === "near" ? "Paid as test USDC on NEAR testnet" : `Arrives as USDC on ${dest === "base" ? "Base" : "Arbitrum"}`}</span>{valid && pos && amt > avail ? <span className="nc-over">Over your available credit</span> : <span />}</div>
        </div>
        <div className="nk-box">
          <label htmlFor="nc-to"><span>Merchant</span><span className="mono">{dest === "near" ? "NEAR account" : "0x address"}</span></label>
          <input id="nc-to" className="nc-addr" value={to} onChange={(e) => { setTo(e.target.value.trim()); clearQuote(); }} placeholder={dest === "near" ? DEMO.merchant : "0x…"} spellCheck={false} />
        </div>
        <div className={`nk-toggle ${in3 ? "on" : ""}`}>
          <div className="nk-toggle-l"><span><b>Pay in 3</b><small>Preview three draws, 30 days apart. No schedule is submitted here.</small></span></div>
          <button type="button" className="nk-switch" role="switch" aria-checked={in3} aria-label="Pay in 3" onClick={() => setIn3(!in3)}><i style={{ transform: in3 ? "translateX(22px)" : undefined }} /></button>
        </div>
        {in3 && valid && <ol className="nc-in3">{schedule.map((s, i) => <li key={i}><span>{i === 0 ? "Today" : s.d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><b>{usd6(BigInt(s.v))}</b></li>)}</ol>}

        {dest === "near" ? (
          <>
            <button className="nk-cta" disabled>Wallet signing: not in this build</button>
            <div className="nc-proof">
              <b>This exact payment has run on testnet</b>
              <p>alice drew 25 test USDC from her line and the contract paid it straight to {short(DEMO.merchant)}. The browser app only reads the contract; the testnet transactions were signed by <span className="mono">scripts/near-testnet.ts</span>.</p>
              {paid && <a className="nk-btn" href={paid.explorer} target="_blank" rel="noreferrer">Open {shortHash(paid.hash)} <Icon.ext /></a>}
            </div>
          </>
        ) : (
          <>
            <button className="nk-cta" disabled={!valid || !recipientOk || busy || !tokens.data} onClick={getQuote}>{busy ? <><span className="spin" /> Asking 1Click…</> : !recipientOk ? "Enter the merchant’s 0x address" : "Get a live 1Click quote"}</button>
            {err && <p className="nk-err" role="alert">{err}</p>}
            {quote && q?.quote && (
              <div className="nc-receipt" aria-live="polite">
                <div className="nc-receipt-h"><span className="nk-pill live">dry: true</span><span className="mono">{new Date(quote.r.timestamp).toLocaleTimeString()}</span></div>
                <dl>
                  <div><dt>You draw</dt><dd>{q.quote.amountInFormatted} USDC <small>on NEAR</small></dd></div>
                  <div><dt>Merchant receives</dt><dd>{q.quote.amountOutFormatted} USDC <small>on {quote.dest === "base" ? "Base" : "Arbitrum"}</small></dd></div>
                  <div><dt>Route cost</dt><dd>{(amt - Number(q.quote.amountOutFormatted)).toFixed(4)} USDC</dd></div>
                  <div><dt>Time estimate</dt><dd>{q.quote.timeEstimate ?? "—"} s</dd></div>
                </dl>
                <button className="nk-cta kaki" disabled>Send: Setup required: NEAR_MAINNET_ACCOUNT</button>
              </div>
            )}
            {!quote && !err && <p className="nc-fine">A real quote from 1click.chaindefuser.com with dry: true. Nothing moves. Last saved route: {SAVED_QUOTES.quotes.find((x) => x.label.includes("Base address"))?.quote.quote.amountOutFormatted} USDC out per 1.00 in, {new Date(SAVED_QUOTES.observedAt).toUTCString().slice(5, 22)} UTC.</p>}
          </>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ melt
function MeltView({ account, pos, posError, aprBps, rates }: { account: string; pos?: Position; posError?: string; aprBps?: number; rates: Live<import("@noren/near-sdk").Rate[]> }) {
  const apy = rates.data?.find((r) => r.token === WBTC_RHEA)?.supply_apy;
  const debt = n6(pos?.debt_usd6), coll = n6(pos?.collateral_usd6);
  const ready = pos && apy !== undefined && aprBps !== undefined;
  const m = ready ? meltCurve(debt, coll, Number(apy), aprBps!) : null;
  const yieldYr = ready ? coll * Number(apy) / 100 : 0, interestYr = ready ? debt * aprBps! / 10_000 : 0;
  const blocked = RECORD.blocked.find((b) => b.step === "harvest");
  return (
    <>
      <section className="nk-card nc-melt">
        <div className="nk-card-h"><div><b>Debt-free on</b><p>{short(account)}, if the collateral earned Rhea’s live WBTC supply rate and every harvest paid the loan down.</p></div><span className="nk-pill warn">Projection</span></div>
        <div className="nk-pad">
          <strong className="nc-date">{posError || rates.error || (rates.data && apy === undefined) ? "Unavailable" : !ready ? "Reading…" : debt === 0 ? "Already debt-free" : m?.payoff ? m.payoff.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" }) : "Not at today’s rates"}</strong>
          {posError && <p className="nk-err">{posError}</p>}
          {rates.error && <p className="nk-err">Rhea rates: {rates.error}</p>}
          {ready && debt > 0 && <MeltChart debtUsd={debt} collateralUsd={coll} supplyApy={Number(apy)} aprBps={aprBps!} />}
          <div className="nk-stats">
            <div className="nk-stat"><small>Yield a year</small><b className="ok">{ready ? `+$${yieldYr.toFixed(2)}` : "—"}</b><small>{apy !== undefined ? `${apy}% Rhea WBTC supply APY, live` : "Rhea rate"}</small></div>
            <div className="nk-stat"><small>Interest a year</small><b className="warn">{ready ? `−$${interestYr.toFixed(2)}` : "—"}</b><small>{aprBps !== undefined ? `${aprBps / 100}% APR on ${usd6(pos?.debt_usd6)}` : "contract APR"}</small></div>
          </div>
        </div>
      </section>
      <section className="nk-card">
        <div className="nk-card-h"><div><b>Harvests</b><p>Each harvest() would turn earned yield into USDC and apply it to the debt.</p></div><span className="nk-pill bad">Blocked</span></div>
        <div className="nk-pad"><div className="nk-empty"><b>No harvests on-chain</b><p>{blocked?.reason ?? "No yield source on testnet."}</p></div></div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ side
function ContractCard({ pool, btc, assetsError }: { pool: Live<import("./data").Pool>; btc?: { price_usd6: string; price_at_ns: string; price_fresh: boolean; source: string }; assetsError?: string }) {
  return (
    <section className="nk-card">
      <div className="nk-card-h"><div><b>The contract</b><p><a className="mono" href={explorerAccount(CONTRACT)} target="_blank" rel="noreferrer">{short(CONTRACT)}</a></p></div><span className={`nk-pill ${pool.error ? "bad" : "live"}`}>{pool.error ? "Read error" : pool.loading && !pool.data ? "Loading" : "Live"}</span></div>
      {pool.error && <p className="nk-err">{pool.error}</p>}
      <div className="nk-stats nc-side-stats">
        <div className="nk-stat"><small>Pool available</small><b>{pool.data ? usd6(pool.data.liquidity, 0) : "—"}</b></div>
        <div className="nk-stat"><small>Utilisation</small><b>{pool.data ? `${(pool.data.utilizationBps / 100).toFixed(1)}%` : "—"}</b></div>
        <div className="nk-stat"><small>BTC price</small><b>{btc ? usd6(btc.price_usd6, 0) : "—"}</b></div>
        <div className="nk-stat"><small>Signed</small><b className={btc && !btc.price_fresh ? "warn" : "ok"}>{btc ? ago(nsToMs(btc.price_at_ns)) : "—"}</b></div>
      </div>
      <p className="nc-fine">{assetsError ? `Price read error: ${assetsError}` : btc ? <>Relayer price (testnet): <a href={btc.source.replace("relayer:", "")} target="_blank" rel="noreferrer">Coinbase BTC-USD</a>, checked with ed25519 on-chain. Older than 90 s blocks borrowing.</> : "Reading the price…"}</p>
    </section>
  );
}

function Activity({ account }: { account: string }) {
  const name = account.split(".")[0];
  const mine = RECORD.steps.filter((s) => s.account === account || (account.endsWith(RECORD.root) && s.step.startsWith(`${name} `)));
  return (
    <section className="nk-card">
      <div className="nk-card-h"><div><b>Activity</b><p>Signed on testnet by the lifecycle script</p></div><span className="nk-pill">{mine.length}</span></div>
      {mine.length ? (
        <ul className="nk-acts nc-acts">
          {mine.slice().reverse().map((s) => (
            <li key={s.hash}>
              <span className={`nk-act-ic nl-dot ${s.status}`} aria-hidden>{s.status === "success" ? <Icon.check /> : <Icon.x />}</span>
              <span><b>{s.step.replace(new RegExp(`^${name} `), "").replace(/^./, (c) => c.toUpperCase())}</b><small>{s.method ?? "transaction"}</small></span>
              <a className="r mono" href={s.explorer} target="_blank" rel="noreferrer">{shortHash(s.hash)} <Icon.ext /></a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="nk-pad"><div className="nk-empty"><b>Nothing recorded for this account</b><p>This build’s log covers the demo accounts. See every transaction on the explorer.</p><a className="nk-btn" href={explorerAccount(account)} target="_blank" rel="noreferrer">Open on nearblocks <Icon.ext /></a></div></div>
      )}
    </section>
  );
}
