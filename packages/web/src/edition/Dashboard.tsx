import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, secs, short, usdc, SERVER, type Config, type InvoiceView, type NorenEvent, type Webhook } from "./api";
import { Copy, Icon, Logo, Setup, isFork, msgOf } from "./ui";
import { LineChart, Menu, Modal, QR, Toasts, downloadCsv, tokenBalance, payoutOf, toast } from "./kit";
import { assetSym } from "./api";
import { TxLink } from "./tx";
import { Mark } from "./logos";
import { NetSwitch, useNet, HOSTED } from "./network";
import { Onboard, listStores, readSession, readStoreId, saveSession, saveStoreId, type Session, type StoreView } from "./Onboard";

export type Tab = "home" | "balances" | "payments" | "links" | "developers" | "settings" | "onboard";
type Quote = { currency: string; fiatAmount: string; usdcAmount: string; rate?: string; quotedAt?: number | string; fiatUsd?: Feed; usdcUsd?: Feed };
type Feed = { feed: string; answer: string; decimals: number; roundId: string; updatedAt: number | string };
type Row = InvoiceView & { quote?: Quote };
type Currency = { code: string; name?: string; symbol?: string; decimals: number };

const TOKEN_KEY = "noren.merchant.token";
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } };
const payLink = (id: string) => `${location.origin}${location.pathname}#/pay/${id}`;
const go = (h: string) => { location.hash = h; };
const STATUS: Record<string, [string, string]> = { paid: ["Succeeded", "ok"], partially_paid: ["Part paid", "info"], refunded: ["Refunded", "muted"], open: ["Incomplete", "info"], draft: ["Link sent", "info"], expired: ["Expired", "muted"] };
const Badge = ({ s }: { s: string }) => { const [t, c] = STATUS[s] ?? [s, "info"]; return <span className={`sd-badge ${c}`}>{t}{s === "paid" && <Icon.check />}{s === "refunded" && <Icon.refund />}</span>; };
const settled = (r: Row) => ["paid", "partially_paid", "refunded"].includes(r.status);
const n6 = (v?: string | bigint) => (v === undefined ? 0 : Number(BigInt(v)) / 1e6);
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (v?: number | string, withYear = false) => { const s = secs(v); if (!s) return "–"; const d = new Date(s * 1000); return d.toLocaleDateString([], { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }) + ", " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const fiatStr = (q?: Quote, cur?: Currency) => { if (!q) return null; const d = cur?.decimals ?? (q.currency === "JPY" || q.currency === "KRW" ? 0 : 2); const v = Number(q.fiatAmount) / 10 ** d; return `${cur?.symbol ?? ""}${v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} ${q.currency}`; };

type Method = "usdc" | "private" | "credit" | "stocks";
const methodOf = (r: Row): Method | null => (settled(r) ? (r.method ?? "usdc") : null);
const stockSym = (asset?: string) => assetSym(asset);
/** Payment methods with their real logos: USDC, the Kohaku pool, the Stock Token paid (NEAR testnet when unknown). Pay later is a concept, so it keeps an icon. */
const METHOD: Record<Method, [string, string, (r?: Row) => JSX.Element]> = {
  usdc: ["USDC", "A direct USDC transfer from the customer's NEAR wallet, verified on-chain", () => <Mark id="USDC" size={16} />],
  private: ["Private · unavailable", "Private checkout is not integrated on NEAR testnet", () => <Mark id="KOHAKU" size={16} />],
  credit: ["Pay later", "Credit against NEP-141 test stocks or BTC, paid on NEAR testnet", () => <span className="sd-pm-ic round" aria-hidden><Icon.layers /></span>],
  stocks: ["Pay with stocks or crypto", "TEST stocks sold to the separate test USDC buyer at a signed relayer price", (r) => <Mark id={stockSym(r?.stock?.asset) ?? "NEAR"} size={16} />],
};
const PM = ({ r }: { r: Row }) => { const m = methodOf(r); if (!m) return <span className="sd-muted">–</span>; const [t, d, I] = METHOD[m]; return <span className={`sd-pm ${m}`} title={d}>{I(r)}{t}{m === "stocks" && stockSym(r.stock?.asset) && <span className="sd-muted">· {stockSym(r.stock?.asset)}</span>}</span>; };
/** The settlement currency with its logo: USDC on NEAR testnet for stock payments, USDC on NEAR for the rest. */
const Cur = ({ r }: { r: Row }) => <span className="lg-row"><Mark id={r.method === "stocks" ? "USDC" : "USDC"} size={16} />{r.method === "stocks" ? "USDC" : "USDC"}</span>;
/** Which chain a payment's transaction is on: stock payments settle on NEAR testnet, the rest on NEAR. */
const payChain = (r: Row) => (r.method === "stocks" ? "near" : "near") as "near" | "near";
/** The chain the money came from. Public payments: NEAR (USDC, private pool, pay later) or NEAR testnet (stocks). */
const From = ({ r }: { r: Row }) => settled(r) ? <span className="lg-row sd-from"><Mark id={r.method === "stocks" ? "NEAR" : "NEAR"} size={16} />{r.method === "stocks" ? "NEAR" : "NEAR"}</span> : <span className="sd-muted">–</span>;
/** What the merchant can know about the payer: "private" only for pool payments; every other method is a public wallet. */
const customerCsv = (x: Row) => !settled(x) ? "" : x.method === "credit" ? `public NEAR account ${x.payments?.at(-1)?.payer ?? ""}` : x.method === "usdc" ? "public NEAR wallet" : x.method === "stocks" ? "public NEAR wallet" : "private";
const Who = ({ r }: { r: Row }) => !settled(r) ? <span className="sd-muted">No payment yet</span> : r.method === "usdc" ? <span className="sd-linked" title="Paid from a public NEAR wallet"><Icon.card />NEAR wallet</span> : r.method === "stocks" ? <span className="sd-linked" title="Paid from a public NEAR testnet wallet"><Icon.chart />NEAR wallet</span> : r.method === "credit" ? <span className="sd-linked" title="Paid from a credit line: the line, and the borrower behind it, are public on-chain"><Icon.layers />Public credit draw</span> : <span className="sd-private"><Icon.eyeOff />Private</span>;

/* ================================================================== shell */
export function Dashboard({ tab, sub }: { tab: Tab; sub?: string }) {
  const [baseCfg, setCfg] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [devToken, setTokenState] = useState(readToken);
  // A signed-in owner (NEP-413 session) acts on its own store; the legacy dev token acts on the dev merchant.
  const [session, setSession] = useState<Session | null>(readSession);
  const [stores, setStores] = useState<StoreView[] | null>(null);
  const [storeId, setStoreId] = useState<string | null>(readStoreId);
  useEffect(() => { if (!session) { setStores(null); return; } listStores(session.session).then(setStores).catch((e) => { if (/Session required/.test(msgOf(e))) { saveSession(null); setSession(null); } else setStores([]); }); }, [session, tab]);
  const store = stores?.find((x) => x.id === storeId) ?? stores?.[0] ?? null;
  const cfg = useMemo(() => (baseCfg && store ? { ...baseCfg, merchant: store.merchant } : baseCfg), [baseCfg, store]);
  const token = store && session ? session.session : devToken;
  const [tick, setTick] = useState(0);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [creating, setCreating] = useState(false);
  const [net] = useNet();
  const setToken = (t: string) => { setTokenState(t); try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } };

  useEffect(() => { api.config().then(setCfg).catch((e) => setErr(msgOf(e))); }, []);
  const signOut = () => { if (session) fetch(`${SERVER}/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${session.session}` } }).catch(() => {});  saveSession(null); setErr(null); setRows(null); setSession(null); setStores(null); go("#/dashboard"); };
  const refresh = useCallback(async () => {
    if (!cfg || !token) return;
    try { setRows(await api.listInvoices(cfg.merchant, token) as Row[]); setErr(null); } catch (e) { setErr(msgOf(e)); }
    api.profile(cfg.merchant).then((p) => setName(p.name)).catch(() => { /* no profile yet */ });
    setTick((t) => t + 1);
  }, [cfg, token]);
  useEffect(() => {
    if (!cfg) return;
    refresh();
    const es = api.events(); const on = () => refresh();
    ["message", "invoice_created", "invoice_bound", "paid", "refunded", "payment.succeeded", "refund.succeeded"].forEach((t) => es.addEventListener(t, on));
    return () => es.close();
  }, [cfg, refresh]);
  useEffect(() => setMenu(false), [tab, sub]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      else if (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName)) { e.preventDefault(); setPalette(true); }
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, []);

  const [onboarding, setOnboarding] = useState(false);
  const firstRun = !!baseCfg && (onboarding || tab === "onboard" || (!devToken && !session) || (!!session && stores !== null && stores.length === 0));
  if (firstRun && baseCfg) return (
    <div className="ob-page">
      <div className="sd-testbar">{HOSTED ? "Noren Merchant · NEAR testnet · Public payments · Test tokens have no value." : "Noren Merchant · NEAR testnet · Public payments · Test tokens have no value."}</div>
      <Onboard cfg={baseCfg} session={session} onSession={(s) => { setErr(null); setSession(s); setOnboarding(true); }} onStore={(st) => { setStores((l) => [...(l ?? []), st]); setStoreId(st.id); }} onDone={() => { setOnboarding(false); go("#/dashboard"); }} />
      <Toasts />
    </div>
  );
  const shop = name ?? "Your shop";
  const nav: [Tab, string, () => JSX.Element, number?][] = [["home", "Home", Icon.home], ["balances", "Balances", Icon.receipt], ["payments", "Payments", Icon.card, rows?.length], ["links", "Payment links", Icon.link]];

  return (
    <div className="sd">
      <div className="sd-testbar">{HOSTED ? "Noren Merchant · NEAR testnet · Public payments · Test tokens have no value." : "Noren Merchant · NEAR testnet · Public payments · Test tokens have no value."}</div>
      <aside className={`sd-side ${menu ? "open" : ""}`}>
        <Menu align="left" trigger={(o) => (
          <button className="sd-acct" onClick={o}><span className="sd-avatar">{shop.slice(0, 1).toUpperCase()}</span><span className="sd-acct-t"><b>{shop}</b><small className="mono">{cfg ? short(cfg.merchant, 6) : "…"}</small></span><span className="sd-chev">⌄</span></button>
        )} items={[["Business settings", () => go("#/dashboard/settings")], ["Copy merchant ID", () => { if (cfg) { navigator.clipboard?.writeText(cfg.merchant); toast("Merchant ID copied"); } }], ...(stores && stores.length > 1 ? stores.filter((x) => x.id !== store?.id).map((x) => [`Switch to ${x.name}`, () => { saveStoreId(x.id); setStoreId(x.id); }] as [string, () => void]) : []), "sep", ["Set up a new store", () => go("#/dashboard/onboard")], ...(session ? [["Sign out", signOut] as [string, () => void]] : []), ["View landing page", () => go("#/")]]} />
        <nav className="sd-nav">
          {nav.map(([k, t, I, c]) => <a key={k} href={`#/dashboard${k === "home" ? "" : `/${k}`}`} aria-current={tab === k ? "page" : undefined}><I /><span>{t}</span>{!!c && <em>{c}</em>}</a>)}
          <span className="sd-nav-h">Developers</span>
          <a href="#/dashboard/developers" aria-current={tab === "developers" && !sub ? "page" : undefined}><Icon.code /><span>API keys</span></a>
          <a href="#/dashboard/developers/webhooks" aria-current={tab === "developers" && sub === "webhooks" ? "page" : undefined}><Icon.hook /><span>Webhooks</span></a>
          <a href="#/dashboard/developers/events" aria-current={tab === "developers" && sub === "events" ? "page" : undefined}><Icon.bolt /><span>Events</span></a>
        </nav>
        <div className="sd-side-foot">
          <a href="#/dashboard/settings" aria-current={tab === "settings" ? "page" : undefined}><Icon.gear /><span>Settings</span></a>
          <p className="mono">{cfg ? `${isFork(cfg) ? "NEAR testnet" : "NEAR testnet"} · ${cfg.chainId}` : "connecting…"}</p>
        </div>
      </aside>

      <div className="sd-body">
        <header className="sd-top">
          <button className="sd-icon-btn sd-burger" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}><Icon.menu /></button>
          <button className="sd-search" onClick={() => setPalette(true)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><span>Search payments, links, events</span><kbd>⌘K</kbd></button>
          <div className="sd-top-r">
            <NetSwitch />
            <a className="sd-icon-btn" href="#/dashboard/developers" title="Developers" aria-label="Developers"><Icon.code /></a>
            <Menu trigger={(o) => <button className="sd-btn primary sm" onClick={o}><Icon.plus /> New</button>} items={[["Payment link", () => setCreating(true), !!token], ["Webhook endpoint", () => go("#/dashboard/developers/webhooks")], ["Business name", () => go("#/dashboard/settings")]]} />
          </div>
        </header>

        <main className="sd-main">
          {err ? <Setup err={err} /> : !cfg ? <div className="sd-loading"><span className="spin" /> Connecting to {SERVER}…</div> : (
            <>
              {!token && tab !== "developers" && <div className="sd-callout"><Icon.lock /><span><b>Sign in</b> to create links and manage your merchant service. Refunds and webhooks are not integrated.</span><a className="sd-btn sm" href="#/dashboard/developers">Add key</a></div>}
              {tab === "home" && <Home rows={rows} shop={shop} cfg={cfg} onCreate={() => setCreating(true)} token={token} />}
              {tab === "balances" && <Balances rows={rows} cfg={cfg} token={token} />}
              {tab === "payments" && (sub ? <PaymentPage id={sub} rows={rows} cfg={cfg} token={token} onDone={refresh} tick={tick} /> : <Payments rows={rows} cfg={cfg} />)}
              {tab === "links" && <Links rows={rows} onCreate={() => setCreating(true)} token={token} />}
              {tab === "developers" && <Developers cfg={cfg} token={token} setToken={setToken} sub={sub} tick={tick} store={store} session={session} onStores={() => session && listStores(session.session).then(setStores).catch(() => {})} />}
              {tab === "settings" && <Settings cfg={cfg} token={token} name={name} onSaved={setName} />}
            </>
          )}
        </main>
      </div>
      {menu && <div className="sd-scrim" onClick={() => setMenu(false)} />}
      {palette && <Palette rows={rows ?? []} onClose={() => setPalette(false)} onCreate={() => { setPalette(false); setCreating(true); }} />}
      {creating && cfg && <CreateLink cfg={cfg} token={token} shop={shop} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); refresh(); go(`#/dashboard/payments/${id}`); }} />}
      <Toasts />
    </div>
  );
}

const PageHead = ({ title, children, sub }: { title: ReactNode; children?: ReactNode; sub?: ReactNode }) => (
  <div className="sd-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="sd-head-act">{children}</div>}</div>
);

/* ================================================================== home */
type Range = "today" | "7d" | "30d" | "90d";
const RANGES: [Range, string][] = [["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 4 weeks"], ["90d", "Last 3 months"]];
function buckets(range: Range, offset = 0) {
  const now = Math.floor(Date.now() / 1000), H = 3600, D = 86400;
  if (range === "today") { const start = new Date(); start.setHours(0, 0, 0, 0); const s = Math.floor(start.getTime() / 1000) - offset * D; return { start: s, step: H, n: 24, end: s + D, label: (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: "numeric" }) }; }
  const days = range === "7d" ? 7 : range === "30d" ? 28 : 90;
  const end = Math.floor(now / D) * D + D - offset * days * D, start = end - days * D;
  return { start, step: D, n: days, end, label: (t: number) => new Date(t * 1000).toLocaleDateString([], { month: "short", day: "numeric" }) };
}
function series(rows: Row[], range: Range, offset: number, pick: (r: Row) => number, at: (r: Row) => number | undefined = (r) => secs(r.paidAt), cumulative = false) {
  const b = buckets(range, offset), vals = Array.from({ length: b.n }, () => 0);
  for (const r of rows) { const t = at(r); if (!t || t < b.start || t >= b.end) continue; vals[Math.floor((t - b.start) / b.step)] += pick(r); }
  if (cumulative) for (let i = 1; i < vals.length; i++) vals[i] += vals[i - 1];
  return { vals, labels: vals.map((_, i) => b.label(b.start + i * b.step)), total: vals.reduce((a, v) => a + v, 0) };
}
const delta = (cur: number, prev: number) => prev === 0 ? (cur === 0 ? null : "new") : `${cur >= prev ? "+" : ""}${(((cur - prev) / prev) * 100).toFixed(1)}%`;

function Home({ rows, shop, cfg, onCreate, token }: { rows: Row[] | null; shop: string; cfg: Config; onCreate: () => void; token: string }) {
  const [range, setRange] = useState<Range>("7d");
  const r = rows ?? [];
  const today = series(r.filter(settled), "today", 0, (x) => n6(x.paidAmount ?? x.invoice.amount), undefined, true);
  const yday = series(r.filter(settled), "today", 1, (x) => n6(x.paidAmount ?? x.invoice.amount), undefined, true);
  const bal = useBalance(cfg);
  const gross = series(r.filter(settled), range, 0, (x) => n6(x.paidAmount ?? x.invoice.amount)), grossP = series(r.filter(settled), range, 1, (x) => n6(x.paidAmount ?? x.invoice.amount));
  const refunds = series(r.filter((x) => x.refundAmount), range, 0, (x) => n6(x.refundAmount), (x) => secs(x.refundedAt)), refundsP = series(r.filter((x) => x.refundAmount), range, 1, (x) => n6(x.refundAmount), (x) => secs(x.refundedAt));
  const count = series(r.filter(settled), range, 0, () => 1), countP = series(r.filter(settled), range, 1, () => 1);
  const links = series(r, range, 0, () => 1, (x) => secs(x.createdAt)), linksP = series(r, range, 1, () => 1, (x) => secs(x.createdAt));
  const net = { vals: gross.vals.map((v, i) => v - refunds.vals[i]), total: gross.total - refunds.total }, netP = grossP.total - refundsP.total;
  const cards: [string, { vals: number[]; total: number }, number, (v: number) => string, string][] = [
    ["Gross volume", gross, grossP.total, (v) => `${fmt(v)} USDC`, "Settled payments, before refunds. Pay-with-stocks payments settle in USDC on NEAR testnet (1:1 USD stablecoin) and are counted here at face value."],
    ["Net volume", net, netP, (v) => `${fmt(v)} USDC`, "Gross volume minus refunds"],
    ["Successful payments", count, countP.total, (v) => String(Math.round(v)), "Verified public NEAR payments"],
    ["Refunds", refunds, refundsP.total, (v) => `${fmt(v)} USDC`, "Refund execution is not built on NEAR"],
    ["Payment links created", links, linksP.total, (v) => String(Math.round(v)), "Including unpaid and expired"],
    ["Average payment", { vals: gross.vals.map((v, i) => (count.vals[i] ? v / count.vals[i] : 0)), total: count.total ? gross.total / count.total : 0 }, countP.total ? grossP.total / countP.total : 0, (v) => `${fmt(v)} USDC`, "Gross volume ÷ payments"],
  ];
  return (
    <>
      <PageHead title="Today" sub={<>Welcome back, {shop}. Accept test USDC, test stocks or credit on NEAR testnet. Payments and customers are public; private checkout is not integrated.</>}>
        <button className="sd-btn primary" disabled={!token} onClick={onCreate}><Icon.plus /> Create payment link</button>
      </PageHead>

      <section className="sd-today">
        <div className="sd-today-chart">
          <div className="sd-kv-row">
            <div><span>Gross volume</span><b>{fmt(today.total ? today.vals[today.vals.length - 1] : 0)} <em>USDC</em></b><small>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>
            <div className="muted"><span>Yesterday</span><b>{fmt(yday.vals[yday.vals.length - 1] ?? 0)} <em>USDC</em></b></div>
          </div>
          <LineChart series={[{ label: "Today", values: today.vals.slice(0, new Date().getHours() + 1) }, { label: "Yesterday", values: yday.vals, dashed: true }]} labels={today.labels} height={150} format={(v) => `${fmt(v)} USDC`} />
          <div className="sd-axis mono"><span>12:00 AM</span><span>Now, {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>11:59 PM</span></div>
        </div>
        <div className="sd-today-side">
          <div className="sd-stat"><span>USDC balance</span><b>{bal.value === null ? <span className="sd-skel w80" /> : `${fmt(n6(bal.value))}`} <em>USDC</em></b><small>{bal.error ? <span className="sd-err-t">{bal.error}</span> : <>On-chain at your payout address <span className="mono">{short(bal.payout ?? "", 6)}</span></>}</small><a href="#/dashboard/balances">View balance <Icon.arrow /></a></div>
          <div className="sd-stat"><span>Payouts</span><b>Instant</b><small>Test USDC is sent to your named NEAR payout account. A receipt is shown after FINAL execution. No private proof is used.</small></div>
          <div className="sd-stat accent"><span>Public payments</span><b>{r.filter(settled).length}</b><small>Payer accounts, amounts and recipients are public on NEAR. Private checkout is not integrated.</small></div>
        </div>
      </section>

      <div className="sd-section-h">
        <h2>Your overview</h2>
        <div className="sd-seg">{RANGES.map(([k, t]) => <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{t}</button>)}</div>
      </div>
      <section className="sd-cards">
        {cards.map(([t, s, prev, f, hint]) => {
          const d = delta(s.total, prev);
          return (
            <article className="sd-card" key={t} title={hint}>
              <header><span>{t}</span>{d && <em className={d.startsWith("-") ? "down" : "up"}>{d}</em>}</header>
              <b>{f(s.total)}</b>
              <small>{f(prev)} previous period</small>
              {rows === null ? <div className="sd-skel h60" /> : <LineChart compact series={[{ label: t, values: s.vals }]} labels={series([], range, 0, () => 0).labels} height={64} format={f} />}
              <div className="sd-axis mono"><span>{series([], range, 0, () => 0).labels[0]}</span><span>{range === "today" ? "Now" : "Today"}</span></div>
            </article>
          );
        })}
      </section>

      <Methods rows={rows} cfg={cfg} />

      <div className="sd-section-h"><h2>Recent payments</h2><a className="sd-link" href="#/dashboard/payments">View all <Icon.arrow /></a></div>
      <PayTable rows={r.slice(0, 6)} loading={!rows} cfg={cfg} />
    </>
  );
}

/** Payment-method mix, and what the credit pool is still owed on lines that paid this merchant (read from NEAR receipts). */
function Methods({ rows }: { rows:Row[]|null; cfg:Config }) {
  const paid = (rows ?? []).filter(settled);
  const mix = (Object.keys(METHOD) as Method[]).map((m) => { const xs = paid.filter((x) => methodOf(x) === m); return { m, n: xs.length, v: xs.reduce((a, x) => a + n6(x.paidAmount ?? x.invoice.amount), 0) }; });
  const total = mix.reduce((a, x) => a + x.v, 0);
 return (
    <section className="sd-methods">
      <div>
        <div className="sd-section-h tight"><h2>Payment methods</h2><span className="sd-muted">{paid.length} settled</span></div>
        <div className="sd-mix" aria-hidden>{total > 0 && mix.map((x) => x.v > 0 && <i key={x.m} className={x.m} style={{ width: `${(x.v / total) * 100}%` }} />)}</div>
        <ul className="sd-mix-l">{mix.map((x) => { const [t, d, I] = METHOD[x.m]; return <li key={x.m} title={d}><span className={`sd-pm ${x.m}`}>{I()}{t}</span><b className="num">{fmt(x.v)} <em className="lg-row"><Mark id={x.m === "stocks" ? "USDC" : "USDC"} size={14} />{x.m === "stocks" ? "USDC" : "USDC"}</em></b><small>{x.n} payment{x.n === 1 ? "" : "s"}{total > 0 && ` · ${Math.round((x.v / total) * 100)}%`}</small></li>; })}</ul>
      </div>
      <div className="sd-exposure"><div className="sd-section-h tight"><h2>Credit-line exposure</h2></div><p className="sd-muted">Completed credit draws pay your NEAR payout account upfront. Loan risk stays with the credit pool. Per-invoice loan-risk analytics are not built.</p></div>
    </section>);
}

function useBalance(cfg: Config) {
  const [s, setS] = useState<{ value: bigint | null; payout?: string; error?: string }>({ value: null });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const payout = await payoutOf(cfg.rpcUrl, cfg.deployment.checkout, cfg.merchant);
        const target = /^0x0{40}$/.test(payout) ? cfg.merchant : payout;
        const value = await tokenBalance(cfg.rpcUrl, cfg.deployment.usdc, target);
        if (live) setS({ value, payout: target });
      } catch (e) { if (live) setS({ value: 0n, error: `Couldn't read the chain: ${msgOf(e)}` }); }
    })();
    return () => { live = false; };
  }, [cfg]);
  return s;
}

/* ================================================================== balances */
function Balances({ rows, cfg, token }: { rows: Row[] | null; cfg: Config; token: string }) {
  const bal = useBalance(cfg);
  const r = rows ?? [];
  const incoming = r.filter((x) => x.status === "open" || x.status === "draft").reduce((a, x) => a + (n6(x.invoice.amount)-n6(x.paidAmount)), 0);
  const ledger = useMemo(() => {
    const e: { at: number; type: string; amount: number; id: string; tx?: string; desc?: string; who: string }[] = [];
    for (const x of r) {
      if (settled(x) && x.paidAt) e.push({ at: secs(x.paidAt)!, type: x.method === "stocks" ? "Payment (USDC, NEAR)" : "Payment", amount: n6(x.paidAmount ?? x.invoice.amount), id: x.invoice.invoiceId, tx: x.paymentTx, desc: x.description, who: customerCsv(x) });
      if (x.refundAmount && x.refundedAt) e.push({ at: secs(x.refundedAt)!, type: "Refund", amount: -n6(x.refundAmount), id: x.invoice.invoiceId, tx: x.refundTx, desc: x.description, who: "private" });
    }
    return e.sort((a, b) => b.at - a.at);
  }, [r]);
  const exportCsv = () => downloadCsv(`noren-balance-${new Date().toISOString().slice(0, 10)}.csv`, [["date", "type", "amount_usdc", "invoice_id", "description", "tx", "customer"], ...ledger.map((l) => [new Date(l.at * 1000).toISOString(), l.type, l.amount.toFixed(6), l.id, l.desc ?? "", l.tx ?? "", l.who])]);
  return (
    <>
      <PageHead title="Balances" sub="USDC settles straight to your payout address on-chain. There is no Noren-held balance to withdraw.">
        <button className="sd-btn" onClick={exportCsv} disabled={!ledger.length}>Export CSV</button>
      </PageHead>
      <section className="sd-bal">
        <div className="sd-bal-main">
          <span>Available balance</span>
          <b>{bal.value === null ? <span className="sd-skel w120" /> : fmt(n6(bal.value))} <em>USDC</em></b>
          <div className="sd-bal-bar">{bal.value !== null && (n6(bal.value) + incoming) > 0 && <><i style={{ width: `${(n6(bal.value) / (n6(bal.value) + incoming)) * 100}%` }} /><i className="b" style={{ width: `${(incoming / (n6(bal.value) + incoming)) * 100}%` }} /></>}</div>
          <ul>
            <li><i className="dot a" /><span>Available</span><b>{bal.value === null ? "…" : fmt(n6(bal.value))} USDC</b></li>
            <li><i className="dot b" /><span>Incoming (open links)</span><b>{fmt(incoming)} USDC</b></li>
          </ul>
          {bal.error && <p className="sd-err-t">{bal.error}</p>}
        </div>
        <dl className="sd-dl">
          <dt>Payout address</dt><dd className="mono">{short(bal.payout ?? cfg.merchant, 8)} <Copy text={bal.payout ?? cfg.merchant} /></dd>
          <dt>Settlement asset</dt><dd><span className="lg-row"><Mark id="USDC" size={16} />USDC</span> on <span className="lg-row"><Mark id="NEAR" size={16} />NEAR</span> · <span className="mono">{short(cfg.deployment.usdc, 6)}</span></dd>
          <dt>Payout timing</dt><dd>Instant, in the payment transaction</dd>
          <dt>Read from</dt><dd className="mono">{cfg.rpcUrl}</dd>
        </dl>
      </section>
      <FundingStatus />
      <div className="sd-section-h"><h2>Balance transactions</h2><span className="sd-muted">{ledger.length}</span></div>
      <div className="sd-table-wrap">
        {!rows ? <div className="sd-skel-rows"><i /><i /><i /></div> : ledger.length === 0 ? <Empty title="No balance transactions yet" text="Payments and refunds appear here as they settle on-chain." /> : (
          <table className="sd-table">
            <thead><tr><th>Type</th><th className="r">Amount</th><th className="hide-s">Description</th><th className="hide-s">Transaction</th><th>Date</th></tr></thead>
            <tbody>{ledger.map((l, i) => (
              <tr key={i} onClick={() => go(`#/dashboard/payments/${l.id}`)}>
                <td><span className={`sd-type ${l.type === "Refund" ? "neg" : ""}`}>{l.type}</span></td>
                <td className={`r num ${l.amount < 0 ? "neg" : ""}`}>{l.amount < 0 ? "−" : "+"}{fmt(Math.abs(l.amount))} <span className="sd-muted lg-row"><Mark id={/USDC/.test(l.type) ? "USDC" : "USDC"} size={14} />{/USDC/.test(l.type) ? "USDC" : "USDC"}</span></td>
                <td className="hide-s">{l.desc || <span className="sd-muted mono">{short(l.id, 8)}</span>}</td>
                <td className="hide-s"><TxLink chain={/USDC/.test(l.type) ? "near" : "near"} cfg={cfg} hash={l.tx} /></td>
                <td className="sd-muted">{dt(l.at)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** Pay-with-stocks proceeds arrive as USDC on NEAR testnet. Settle them to USDC on NEAR through the value bridge. */
function FundingStatus(){return <section className="sd-panel"><h2>One chain: NEAR testnet</h2><p className="sd-muted">Payments settle in test USDC. Other-chain funding is a mainnet dry quote only; nothing moves on testnet.</p></section>}

type Filter = "all" | "paid" | "refunded" | "open" | "expired";
function Payments({ rows, cfg }: { rows: Row[] | null; cfg: Config }) {
  const [f, setF] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<"all" | Range>("all");
  const [pm, setPm] = useState<"all" | Method>("all");
  const r = (rows ?? []).filter((x) => pm === "all" || methodOf(x) === pm);
  const inRange = (x: Row) => { if (range === "all") return true; const b = buckets(range); const t = secs(x.paidAt ?? x.createdAt) ?? 0; return t >= b.start && t < b.end; };
  const match = (x: Row) => !q || [x.invoice.invoiceId, x.description, x.paymentTx, x.refundTx, usdc(x.invoice.amount)].some((v) => v && String(v).toLowerCase().includes(q.toLowerCase()));
  const byStatus = (x: Row, k: Filter) => k === "all" || x.status === k || (k === "open" && x.status === "draft");
  const shown = r.filter((x) => byStatus(x, f) && match(x) && inRange(x));
  const counts = Object.fromEntries((["all", "paid", "refunded", "open", "expired"] as Filter[]).map((k) => [k, r.filter((x) => byStatus(x, k) && match(x) && inRange(x)).length])) as Record<Filter, number>;
  const exportCsv = () => downloadCsv(`noren-payments-${new Date().toISOString().slice(0, 10)}.csv`, [["invoice_id", "status", "amount_usdc", "presentment", "description", "created", "paid", "refunded_usdc", "payment_tx", "refund_tx", "gas_used", "method", "customer"], ...shown.map((x) => [x.invoice.invoiceId, x.status, n6(x.paidAmount ?? x.invoice.amount).toFixed(6), fiatStr(x.quote) ?? "", x.description ?? "", secs(x.createdAt) ? new Date(secs(x.createdAt)! * 1000).toISOString() : "", secs(x.paidAt) ? new Date(secs(x.paidAt)! * 1000).toISOString() : "", x.refundAmount ? n6(x.refundAmount).toFixed(6) : "", x.paymentTx ?? "", x.refundTx ?? "", x.paymentGasUsed ?? "", methodOf(x) ?? "", customerCsv(x)])]);
  return (
    <>
      <PageHead title="Payments"><button className="sd-btn" onClick={exportCsv} disabled={!shown.length}>Export</button></PageHead>
      <div className="sd-tabs" role="tablist">
        {([["all", "All"], ["paid", "Succeeded"], ["refunded", "Refunded"], ["open", "Incomplete"], ["expired", "Expired"]] as [Filter, string][]).map(([k, t]) => <button key={k} role="tab" aria-selected={f === k} onClick={() => setF(k)}><span>{t}</span><b>{counts[k]}</b></button>)}
      </div>
      <div className="sd-filters">
        <label className="sd-filter-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input placeholder="Filter by ID, description, amount or tx" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter payments" /></label>
        <Menu align="left" trigger={(o) => <button className={`sd-chip ${range !== "all" ? "on" : ""}`} onClick={o}><Icon.plus /> Date{range !== "all" && `: ${RANGES.find(([k]) => k === range)?.[1]}`}</button>} items={[["Any time", () => setRange("all")], ...RANGES.map(([k, t]) => [t, () => setRange(k)] as [string, () => void])]} />
        <Menu align="left" trigger={(o) => <button className={`sd-chip ${pm !== "all" ? "on" : ""}`} onClick={o}><Icon.plus /> Payment method{pm !== "all" && `: ${METHOD[pm][0]}`}</button>} items={[["Any method", () => setPm("all")], ...(Object.keys(METHOD) as Method[]).map((k) => [METHOD[k][0], () => setPm(k)] as [string, () => void])]} />
      </div>
      <PayTable rows={shown} loading={!rows} cfg={cfg} />
      {rows && <p className="sd-foot-n">{shown.length} result{shown.length === 1 ? "" : "s"}</p>}
      <CrossChainPayments merchant={cfg.merchant} />
    </>
  );
}

/** Intents funding is a mainnet dry quote only, never a testnet payment. */
function CrossChainPayments({merchant}:{merchant:string}){return <div className="sd-panel"><h2>Funding from other chains</h2><p className="sd-muted">Not on NEAR testnet. The app offers Intents mainnet dry quotes only; nothing moves.</p></div>}

function PayTable({ rows, loading, cfg }: { rows: Row[]; loading?: boolean; cfg: Config }) {
  if (loading) return <div className="sd-table-wrap"><div className="sd-skel-rows"><i /><i /><i /></div></div>;
  if (!rows.length) return <div className="sd-table-wrap"><Empty title="No payments match" text="Create a payment link and pay it on the NEAR checkout. It shows up here the moment it settles." action={<a className="sd-btn sm" href="#/dashboard/links">Go to payment links</a>} /></div>;
  return (
    <div className="sd-table-wrap">
      <table className="sd-table">
        <thead><tr><th className="r">Amount</th><th />  <th>Status</th><th className="hide-s">Payment method</th><th className="hide-s">From</th><th className="hide-m">Description</th><th>Customer</th><th className="hide-m">Transaction</th><th className="hide-s">Date</th><th /></tr></thead>
        <tbody>{rows.map((x) => (
          <tr key={x.invoice.invoiceId} tabIndex={0} onClick={() => go(`#/dashboard/payments/${x.invoice.invoiceId}`)} onKeyDown={(e) => e.key === "Enter" && go(`#/dashboard/payments/${x.invoice.invoiceId}`)}>
            <td className="r num"><b>{usdc(settled(x)?x.paidAmount:x.invoice.amount)}</b></td>
            <td className="sd-cur"><Cur r={x} />{x.quote && <small>{fiatStr(x.quote)}</small>}</td>
            <td><Badge s={x.status} /></td>
            <td className="hide-s"><PM r={x} /></td>
            <td className="hide-s"><From r={x} /></td>
            <td className="hide-m sd-desc">{x.description || <span className="sd-muted mono">{short(x.invoice.invoiceId, 8)}</span>}</td>
            <td><Who r={x} /></td>
            <td className="hide-m">{x.paymentTx ? <TxLink chain={payChain(x)} cfg={cfg} hash={x.paymentTx} /> : <span className="sd-muted">–</span>}</td>
            <td className="hide-s sd-muted">{dt(x.paidAt ?? x.createdAt)}</td>
            <td className="r"><Menu trigger={(o) => <button className="sd-icon-btn sm" onClick={o} aria-label="Row actions">⋯</button>} items={[["View payment details", () => go(`#/dashboard/payments/${x.invoice.invoiceId}`)], ["Copy payment ID", () => { navigator.clipboard?.writeText(x.invoice.invoiceId); toast("Payment ID copied"); }], ["Copy checkout link", () => { navigator.clipboard?.writeText(payLink(x.invoice.invoiceId)); toast("Checkout link copied"); }], ["Open hosted checkout", () => go(`#/pay/${x.invoice.invoiceId}`)]]} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const Empty = ({ title, text, action }: { title: string; text: string; action?: ReactNode }) => <div className="sd-empty"><span className="sd-empty-ic"><Icon.card /></span><b>{title}</b><p>{text}</p>{action}</div>;

/* ================================================================== payment detail */
function PaymentPage({ id, rows, cfg, token, onDone, tick }: { id: string; rows: Row[] | null; cfg: Config; token: string; onDone: () => void; tick: number }) {
  const r = rows?.find((x) => x.invoice.invoiceId.toLowerCase() === id.toLowerCase());
  const [refunding, setRefunding] = useState(false);
  const [events, setEvents] = useState<NorenEvent[] | null>(null);
  useEffect(() => { if (!token) { setEvents([]); return; } api.eventLog(cfg.merchant, token).then((l) => setEvents(l.filter((e) => String(e.data?.invoiceId ?? "").toLowerCase() === id.toLowerCase()))).catch(() => setEvents([])); }, [cfg, token, id, tick]);
  if (!rows) return <div className="sd-loading"><span className="spin" /> Loading payment…</div>;
  if (!r) return <><a className="sd-back" href="#/dashboard/payments"><Icon.back /> Payments</a><Empty title="Payment not found" text={`No payment ${short(id, 10)} in this merchant's records.`} /></>;
  const credit = r.method === "credit", stock = r.method === "stocks";
  const steps: [string, number | string | undefined, ReactNode, boolean][] = stock ? [
    ["Payment link created", r.createdAt, r.description ? `“${r.description}”` : null, true],
    ["Paid with Stock Tokens on NEAR testnet, USDC received", r.paidAt, r.paymentTx ? <><TxLink chain="near" hash={r.paymentTx} n={8} /> · NEAR stock buyer callback, gas paid by the customer</> : null, settled(r)],
  ] : credit ? [
    ["Payment link created", r.createdAt, r.description ? `“${r.description}”` : null, true],
    ["Paid later from a credit line, USDC received", r.paidAt, r.paymentTx ? <><TxLink chain="near" cfg={cfg} hash={r.paymentTx} n={8} /> · Noren credit borrow / due installment, gas paid by the customer</> : null, settled(r)],
  ] : [
    ["Payment link created", r.createdAt, r.description ? `“${r.description}”` : null, true],
    ["Customer payment verified against NEAR FINAL execution", r.paidAt, "Payer and amount are public on NEAR testnet", settled(r)],
    ["Public token transfer finalized, test USDC received", r.paidAt, r.paymentTx ? <><TxLink chain="near" cfg={cfg} hash={r.paymentTx} n={8} />{r.paymentGasUsed && <> · {Number(r.paymentGasUsed).toLocaleString()} gas paid by you</>}</> : null, settled(r)],
    ["Refund (not integrated on NEAR)", r.refundedAt, r.refundTx ? <>{usdc(r.refundAmount)} USDC · <TxLink chain="near" cfg={cfg} hash={r.refundTx} n={8} /></> : null, r.status === "refunded"],
  ];
  return (
    <>
      <a className="sd-back" href="#/dashboard/payments"><Icon.back /> Payments</a>
      <div className="sd-pay-head">
        <div>
          <span className="sd-eyebrow">Payment</span>
          <h1><span className="num">{usdc(r.invoice.amount)}</span> <em className="lg-row"><Mark id={stock ? "USDC" : "USDC"} size={24} />{stock ? "USDC" : "USDC"}</em> <Badge s={r.status} /></h1>
          {r.quote && <p className="sd-quote-line">Priced at <b>{fiatStr(r.quote)}</b> · Legacy quote metadata</p>}
        </div>
        <div className="sd-head-act">
          {r.status === "paid" && !credit && !stock && <button className="sd-btn" disabled title="NEAR checkout refunds are not built" onClick={() => setRefunding(true)}><Icon.refund /> Refund</button>}
          <Menu trigger={(o) => <button className="sd-btn" onClick={o} aria-label="More actions">⋯</button>} items={[["Copy payment ID", () => { navigator.clipboard?.writeText(r.invoice.invoiceId); toast("Payment ID copied"); }], ["Copy checkout link", () => { navigator.clipboard?.writeText(payLink(r.invoice.invoiceId)); toast("Checkout link copied"); }], ["Open hosted checkout", () => go(`#/pay/${r.invoice.invoiceId}`)]]} />
        </div>
      </div>
      <div className="sd-summary">
        <div><span>Last update</span><b>{dt(r.refundedAt ?? r.paidAt ?? r.boundAt ?? r.createdAt)}</b></div>
        <div><span>Customer</span><b><Who r={r} /></b></div>
        <div><span>Payment method</span><b><PM r={r} /></b></div>
        <div><span>Network fee</span><b>{r.paymentGasUsed ? `${Number(r.paymentGasUsed).toLocaleString()} gas · paid by ${credit || stock ? "the customer" : "you"}` : "–"}</b></div>
      </div>

      <div className="sd-detail-grid">
        <div>
          <section className="sd-panel">
            <h2>Timeline</h2>
            <ol className="sd-tl">{steps.map(([t, at, d, on]) => <li key={t} data-on={on}><i /><div><b>{t}</b><span>{on ? dt(at, true) : "Not yet"}</span>{on && d && <p>{d}</p>}</div></li>)}</ol>
          </section>
          <section className="sd-panel">
            <h2>Events and webhooks</h2>
            {!token ? <p className="sd-muted">Add your secret key to see this payment's events.</p> : events === null ? <div className="sd-skel-rows"><i /></div> : events.length === 0 ? <p className="sd-muted">No events recorded for this payment.</p> : (
              <ul className="sd-evmini">{events.map((e) => { const d = e.deliveries ?? []; const ok = d.some((x) => x.ok); return <li key={e.id}><code>{e.type}</code><span className={`sd-badge ${d.length === 0 ? "muted" : ok ? "ok" : "bad"}`}>{d.length === 0 ? "No endpoints" : ok ? "Delivered" : `Failed · ${d.length} tries`}</span><span className="sd-muted">{dt(e.created)}</span></li>; })}</ul>
            )}
          </section>
        </div>
        <div>
          <section className="sd-panel">
            <h2>Payment details</h2>
            <dl className="sd-dl">
              <dt>Payment ID</dt><dd className="mono">{short(r.invoice.invoiceId, 10)} <Copy text={r.invoice.invoiceId} /></dd>
              <dt>Amount</dt><dd>{usdc(r.invoice.amount)} {stock ? "USDC (invoice priced in USDC, 1:1)" : "USDC"}</dd>
              {r.refundAmount && <><dt>Refunded</dt><dd>{usdc(r.refundAmount)} USDC</dd></>}
              <dt>Description</dt><dd>{r.description || "–"}</dd>
              <dt>Expires</dt><dd>{dt(r.invoice.expiry, true)}</dd>
              <dt>Checkout</dt><dd><a href={`#/pay/${r.invoice.invoiceId}`} className="mono">/pay/{short(r.invoice.invoiceId, 6)}</a></dd>
            </dl>
          </section>
          <section className="sd-panel">
            <h2>Payment method</h2>
            <dl className="sd-dl">
              <dt>Type</dt><dd>{stock ? 'TEST stock sale to the separate test USDC buyer' : credit ? 'Public stock/BTC-backed credit draw' : 'Public test USDC transfer'}</dd>
              {stock && r.stock && <><dt>Paid with</dt><dd>{(Number(r.stock.assetIn)/1e8).toLocaleString('en-US',{maximumFractionDigits:8})} {stockSym(r.stock.asset)}</dd></>}
              <dt>Received so far</dt><dd>{usdc(r.paidAmount ?? '0')} test USDC</dd>
              <dt>Payer</dt><dd className="mono">{r.payments?.at(-1)?.payer ?? 'Payment not completed'}</dd>
              <dt>Network</dt><dd>NEAR testnet · public</dd>
              <dt>Privacy</dt><dd>Private checkout is not integrated on NEAR.</dd>
              <dt>Settlement</dt><dd>Each successful draw or sale pays your payout account directly. A schedule alone sends nothing.</dd>
            </dl>
          </section>

        </div>
      </div>

    </>
  );
}

function Links({ rows, onCreate, token }: { rows: Row[] | null; onCreate: () => void; token: string }) {
  const [qr, setQr] = useState<Row | null>(null);
  const links = (rows ?? []).filter((x) => x.status === "draft" || x.status === "open" || x.status === "expired");
  return (
    <>
      <PageHead title="Payment links" sub="Share a link anywhere. Customers pay with test stocks, test USDC or credit on the public NEAR checkout."><button className="sd-btn primary" disabled={!token} onClick={onCreate}><Icon.plus /> Create payment link</button></PageHead>
      <div className="sd-table-wrap">
        {!rows ? <div className="sd-skel-rows"><i /><i /></div> : links.length === 0 ? <Empty title="No open payment links" text="Create one to accept test USDC, test stocks or credit. Paid links move to Payments." action={token ? <button className="sd-btn sm primary" onClick={onCreate}><Icon.plus /> Create payment link</button> : undefined} /> : (
          <table className="sd-table">
            <thead><tr><th>Link</th><th className="r">Price</th><th>Status</th><th className="hide-s">Created</th><th className="hide-s">Expires</th><th /></tr></thead>
            <tbody>{links.map((x) => (
              <tr key={x.invoice.invoiceId} onClick={() => go(`#/dashboard/payments/${x.invoice.invoiceId}`)}>
                <td><div className="sd-linkcell"><b>{x.description || "Payment"}</b><span className="mono">/pay/{short(x.invoice.invoiceId, 6)}</span></div></td>
                <td className="r num"><b>{usdc(x.invoice.amount)}</b> <span className="sd-muted">USDC</span>{x.quote && <small className="sd-sub">{fiatStr(x.quote)}</small>}</td>
                <td><Badge s={x.status} /></td>
                <td className="hide-s sd-muted">{dt(x.createdAt)}</td>
                <td className="hide-s sd-muted">{dt(x.invoice.expiry)}</td>
                <td className="r">{x.status !== "expired" && <span className="sd-row-act"><button className="sd-btn xs" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(payLink(x.invoice.invoiceId)); toast("Link copied"); }}>Copy link</button><button className="sd-btn xs" onClick={(e) => { e.stopPropagation(); setQr(x); }}>QR</button></span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {qr && <Modal title="Scan to pay" onClose={() => setQr(null)}><div className="sd-qr-wrap"><QR text={payLink(qr.invoice.invoiceId)} size={220} /><b>{usdc(qr.invoice.amount)} USDC</b><span className="sd-muted">{qr.description || "Payment"}</span><Copy text={payLink(qr.invoice.invoiceId)} label="Copy link" /></div></Modal>}
    </>
  );
}

function CreateLink({ cfg, token, shop, onClose, onDone }: { cfg: Config; token: string; shop: string; onClose: () => void; onDone: (id: string) => void }) {
  const [currency, setCurrency] = useState("USDC");
  const [amount, setAmount] = useState("7.50");
  const [desc, setDesc] = useState("");
  const [mins, setMins] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[] | null>(null);
  const [priceErr, setPriceErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const cur = currencies?.find((c) => c.code === currency);
  useEffect(() => { fetch(`${SERVER}/pricing/currencies`).then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`); return r.json(); }).then((l) => setCurrencies((Array.isArray(l) ? l : l.currencies ?? []).filter((c: Currency) => c.code !== "USDC"))).catch((e) => setPriceErr(msgOf(e))); }, []);
  const minor = useMemo(() => { const d = cur?.decimals ?? 2; const v = Number(amount || 0); return v > 0 ? BigInt(Math.round(v * 10 ** d)) : 0n; }, [amount, cur]);
  const tRef = useRef<number>();
  useEffect(() => {
    setQuote(null); if (currency === "USDC" || minor <= 0n) return;
    clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => { fetch(`${SERVER}/pricing/quote?currency=${currency}&amount=${minor}`).then(async (r) => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`); return j; }).then((q) => { setQuote(q); setPriceErr(null); }).catch((e) => setPriceErr(msgOf(e))); }, 300);
  }, [currency, minor]);
  const numeric = Number(amount); const usdcAmount = Number.isFinite(numeric) && /^\d+(?:\.\d{1,6})?$/.test(amount) ? numeric : null;
  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const expiry = Math.floor(Date.now() / 1000) + mins * 60;
      const body = currency === "USDC" ? { amount: String(Math.round(Number(amount) * 1e6)), expiry: String(expiry), ...(desc.trim() ? { description: desc.trim() } : {}) } : { currency, fiatAmount: minor.toString(), expiry: String(expiry), ...(desc.trim() ? { description: desc.trim() } : {}) };
      if (currency === "USDC" && !(Number(amount) > 0)) throw new Error("Enter an amount above 0");
      const res = await fetch(`${SERVER}/merchants/${cfg.merchant}/invoices`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null); if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      toast("Payment link created"); navigator.clipboard?.writeText(payLink(j.invoice.invoiceId)).catch(() => {}); onDone(j.invoice.invoiceId);
    } catch (e) { setErr(msgOf(e)); } finally { setBusy(false); }
  };
  return (
    <Modal wide title="Create a payment link" onClose={onClose} footer={<><span className="sd-muted sm">The link is copied when you create it.</span><button className="sd-btn" onClick={onClose}>Cancel</button><button className="sd-btn primary" disabled={busy || !token || !(usdcAmount && usdcAmount > 0)} onClick={create}>{busy ? <><span className="spin" /> Creating…</> : "Create link"}</button></>}>
      <div className="sd-builder">
        <div className="sd-builder-form">
          <label className="sd-label" htmlFor="cl-desc">Product or service</label>
          <input id="cl-desc" className="sd-input" maxLength={120} placeholder="Flat white" value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus />
          <p className="sd-help">Only you and the customer see this. It never goes on-chain.</p>
          <label className="sd-label" htmlFor="cl-amt">Price</label>
          <div className="sd-input-money">
            <input id="cl-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency">
              <option value="USDC">USDC</option>
              {(currencies ?? []).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <p className="sd-help">Test USDC only. Fiat conversion is not integrated on NEAR.</p>
          <label className="sd-label">Link expires after</label>
          <div className="sd-seg full">{[15, 30, 60, 1440].map((m) => <button key={m} aria-pressed={mins === m} onClick={() => setMins(m)}>{m < 60 ? `${m} min` : m === 60 ? "1 hour" : "24 hours"}</button>)}</div>
          {currency !== "USDC" && <p className="sd-help">The rate is locked until the link expires, like an FX quote. The customer's proof then fixes the USDC amount on-chain.</p>}
          {err && <p className="sd-error" role="alert">{err}</p>}
        </div>
        <div className="sd-builder-preview" aria-label="Checkout preview">
          <span className="sd-eyebrow">Preview</span>
          <div className="sd-prev">
            <div className="sd-prev-l"><span className="sd-prev-shop"><i>{shop.slice(0, 1).toUpperCase()}</i>{shop}</span><small>Pay {shop}</small><b>{usdcAmount !== null ? fmt(usdcAmount) : "…"}<em>USDC</em></b>{currency !== "USDC" && <small className="sd-prev-fiat">{amount} {currency}</small>}<span className="sd-prev-line"><span>{desc || "Payment"}</span><span>{usdcAmount !== null ? fmt(usdcAmount) : "…"}</span></span></div>
            <div className="sd-prev-r"><span>Pay <em>on NEAR</em></span><i /><i /><i /><span className="sd-prev-btn">Pay {usdcAmount !== null ? fmt(usdcAmount) : ""} USDC</span></div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================================================================== developers */
function Developers({ cfg, token, setToken, sub, tick, store, session, onStores }: { cfg: Config; token: string; setToken: (t: string) => void; sub?: string; tick: number; store: StoreView | null; session: Session | null; onStores: () => void }) {
  const t = sub === "webhooks" || sub === "events" ? sub : "keys";
  return (
    <>
      <PageHead title={t === "keys" ? "API keys" : t === "webhooks" ? "Webhooks" : "Events"} sub={t === "keys" ? "Authenticate requests to your Noren server." : t === "webhooks" ? "Not integrated on NEAR. Poll invoice receipts instead." : "Local merchant events backed by verified payment receipts."} />
      {t === "keys" && (store && session ? <StoreKeys store={store} session={session} onChange={onStores} /> : <Keys cfg={cfg} token={token} setToken={setToken} />)}
      {t === "webhooks" && <Hooks cfg={cfg} token={token} tick={tick} />}
      {t === "events" && <Events cfg={cfg} token={token} tick={tick} />}
    </>
  );
}

/** A signed-in store's keys: publishable key, secret keys by prefix (the server keeps only hashes), roll and revoke. */
function StoreKeys({ store, session, onChange }: { store: StoreView; session: Session; onChange: () => void }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const call = async (path: string, method: string) => { const r = await fetch(`${SERVER}${path}`, { method, headers: { authorization: `Bearer ${session.session}` } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j; };
  const act = async (k: string, f: () => Promise<void>) => { setBusy(k); try { await f(); onChange(); } catch (e) { toast(msgOf(e), "err"); } finally { setBusy(null); } };
  return (
    <>
      <div className="sd-table-wrap">
        <table className="sd-table static">
          <thead><tr><th>Name</th><th>Token</th><th className="hide-s">Created</th><th /></tr></thead>
          <tbody>
            <tr><td><b>Publishable key</b><small className="sd-sub">safe in a browser</small></td><td className="mono">{store.publishableKey}</td><td className="hide-s sd-muted">{dt(store.createdAt)}</td><td className="r"><Copy text={store.publishableKey} /></td></tr>
            <tr><td><b>Merchant ID</b><small className="sd-sub">local service record</small></td><td className="mono">{short(store.merchant, 10)}</td><td className="hide-s sd-muted"><TxLink chain="near" hash={store.registerTx} /></td><td className="r"><Copy text={store.merchant} /></td></tr>
            {store.keys.map((k) => (
              <tr key={k.id}><td><b>Secret key</b><small className="sd-sub">{k.revokedAt ? `revoked ${dt(k.revokedAt)}` : "test mode"}</small></td><td className="mono">{k.prefix}{"•".repeat(16)}</td><td className="hide-s sd-muted">{dt(k.createdAt)}</td><td className="r">{!k.revokedAt && <button className="sd-btn xs" disabled={!!busy} onClick={() => { if (confirm("Revoke this secret key? Requests using it fail immediately.")) act(k.id, async () => { await call(`/stores/${store.id}/keys/${k.id}`, "DELETE"); toast("Secret key revoked"); }); }}>{busy === k.id ? "Revoking…" : "Revoke"}</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="sd-panel narrow">
        <h2>Secret keys</h2>
        <p className="sd-muted">Noren stores only a hash of each secret key, so a key is shown once, when you create it.</p>
        {fresh && <div className="sd-secret"><code className="mono">{fresh}</code><Copy text={fresh} /></div>}
        <div className="sd-row"><button className="sd-btn primary" disabled={!!busy} onClick={() => act("new", async () => { const r = await call(`/stores/${store.id}/keys`, "POST"); setFresh(r.secretKey); toast("New secret key created"); })}>{busy === "new" ? "Creating…" : "Create secret key"}</button></div>
      </section>
    </>
  );
}

function Keys({cfg,token,setToken}:{cfg:Config;token:string;setToken:(token:string)=>void}){return <section className="sd-panel narrow"><h2>Sign in to manage API keys</h2><p className="sd-muted">Connect Meteor and create a local NEAR merchant store first.</p><a className="sd-btn primary" href="#/dashboard/onboard">Sign in</a></section>}

function Hooks({ cfg, token, tick }: { cfg: Config; token: string; tick: number }) {
  const [list, setList] = useState<Webhook[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [fresh, setFresh] = useState<Webhook | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<NorenEvent[]>([]);
  const load = useCallback(() => { if (!token) { setList([]); return; } api.webhooks(cfg.merchant, token).then(setList).catch((e) => { setErr(msgOf(e)); setList([]); }); api.eventLog(cfg.merchant, token).then(setEvents).catch(() => setEvents([])); }, [cfg, token]);
  useEffect(load, [load, tick]);
  const add = async () => { setBusy(true); setErr(null); try { const w = await api.addWebhook(cfg.merchant, url.trim(), token); setFresh(w); setUrl(""); setAdding(false); load(); } catch (e) { setErr(msgOf(e)); } finally { setBusy(false); } };
  const del = async (id: string) => { try { await api.deleteWebhook(cfg.merchant, id, token); toast("Endpoint removed"); load(); } catch (e) { toast(msgOf(e), "err"); } };
  const stats = (id: string) => { const d = events.flatMap((e) => (e.deliveries ?? []).filter((x) => x.endpointId === id)); return { total: d.length, ok: d.filter((x) => x.ok).length }; };
  return (
    <>
      <div className="sd-head-act end"><button className="sd-btn primary" disabled title="Signed webhook delivery is not integrated on NEAR" onClick={() => setAdding(true)}><Icon.plus /> Add endpoint</button></div>
      {err && <p className="sd-error">{err}</p>}
      {fresh?.secret && (
        <div className="sd-callout ok"><Icon.lock /><span><b>Signing secret for {fresh.url}</b>, shown once. Verify the <code>noren-signature</code> header with it.<code className="sd-secret">{fresh.secret}</code></span><span className="sd-row-act"><Copy text={fresh.secret} label="Copy secret" /><button className="sd-btn xs" onClick={() => setFresh(null)}>Done</button></span></div>
      )}
      <div className="sd-table-wrap">
        {!list ? <div className="sd-skel-rows"><i /></div> : list.length === 0 ? <Empty title="No webhook endpoints" text={token ? "Signed webhook delivery is not integrated on NEAR. Poll GET /api/invoices/:id for verified payment status." : "Add your secret key under API keys first."} /> : (
          <table className="sd-table static">
            <thead><tr><th>Endpoint</th><th className="hide-s">Deliveries</th><th className="hide-s">Created</th><th /></tr></thead>
            <tbody>{list.map((w) => { const s = stats(w.id); return (
              <tr key={w.id}><td><b className="mono sd-break">{w.url}</b><small className="sd-sub mono">{w.id}</small></td><td className="hide-s">{s.total ? <span className={`sd-badge ${s.ok === s.total ? "ok" : "bad"}`}>{s.ok}/{s.total} succeeded</span> : <span className="sd-muted">none yet</span>}</td><td className="hide-s sd-muted">{dt(w.createdAt)}</td><td className="r"><Menu trigger={(o) => <button className="sd-icon-btn sm" onClick={o} aria-label="Endpoint actions">⋯</button>} items={[["Copy URL", () => { navigator.clipboard?.writeText(w.url); toast("URL copied"); }], ["Remove endpoint", () => del(w.id)]]} /></td></tr>
            ); })}</tbody>
          </table>
        )}
      </div>
      <section className="sd-panel sd-code">
        <h2>Poll a verified receipt</h2>
        <pre>{`const receipt = await fetch('/api/invoices/' + invoiceId).then(r => r.json());
// Only status === 'paid' means the full amount has been received.
// 'partially_paid' reports the amount paid by completed due draws.
if (receipt.status === 'paid') fulfil(receipt.invoice.invoiceId);`}</pre>
      </section>
      {adding && (
        <Modal title="Add a webhook endpoint" onClose={() => setAdding(false)} footer={<><button className="sd-btn" onClick={() => setAdding(false)}>Cancel</button><button className="sd-btn primary" disabled={busy || !url.trim()} onClick={add}>{busy ? <span className="spin" /> : "Add endpoint"}</button></>}>
          <label className="sd-label" htmlFor="wh">Endpoint URL</label>
          <input id="wh" className="sd-input mono" placeholder="https://your-shop.example/noren" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
          <p className="sd-help">Not integrated on NEAR. No webhook will be sent.</p>
          {err && <p className="sd-error">{err}</p>}
        </Modal>
      )}
    </>
  );
}

function Events({ cfg, token, tick }: { cfg: Config; token: string; tick: number }) {
  const [list, setList] = useState<NorenEvent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<NorenEvent | null>(null);
  const [type, setType] = useState("all");
  useEffect(() => { if (!token) { setList([]); return; } api.eventLog(cfg.merchant, token).then((l) => { setList(l); setErr(null); }).catch((e) => { setErr(msgOf(e)); setList([]); }); }, [cfg, token, tick]);
  const types = ["all", ...Array.from(new Set((list ?? []).map((e) => e.type)))];
  const shown = (list ?? []).filter((e) => type === "all" || e.type === type);
  const cur = sel && shown.find((e) => e.id === sel.id) ? sel : shown[0] ?? null;
  return (
    <>
      <div className="sd-filters">{types.map((t) => <button key={t} className={`sd-chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{t === "all" ? "All events" : t}</button>)}</div>
      {err && <p className="sd-error">{err}</p>}
      {!token ? <div className="sd-table-wrap"><Empty title="Add your secret key" text="The event log is private to the merchant." /></div> : !list ? <div className="sd-table-wrap"><div className="sd-skel-rows"><i /><i /></div></div> : shown.length === 0 ? <div className="sd-table-wrap"><Empty title="No events yet" text="Create a payment link to emit invoice.created." /></div> : (
        <div className="sd-split">
          <ul className="sd-evlist">{shown.map((e) => { const d = e.deliveries ?? []; const ok = d.some((x) => x.ok); return (
            <li key={e.id}><button aria-current={cur?.id === e.id} onClick={() => setSel(e)}><code>{e.type}</code><span className="sd-muted">{dt(e.created)}</span><span className={`sd-dot ${d.length === 0 ? "" : ok ? "ok" : "bad"}`} title={d.length === 0 ? "No endpoints" : ok ? "Delivered" : "Failed"} /></button></li>
          ); })}</ul>
          {cur && (
            <section className="sd-evdetail">
              <header><code>{cur.type}</code><span className="sd-muted mono">{cur.id}</span></header>
              {String(cur.data?.invoiceId ?? "") && <a className="sd-link" href={`#/dashboard/payments/${cur.data.invoiceId}`}>View payment <Icon.arrow /></a>}
              <h3>Event data</h3>
              <pre>{JSON.stringify({ id: cur.id, type: cur.type, created: cur.created, data: cur.data }, null, 2)}</pre>
              <h3>Webhook attempts</h3>
              {(cur.deliveries ?? []).length === 0 ? <p className="sd-muted">No endpoints were registered when this happened.</p> : <ul className="sd-deliv">{cur.deliveries!.map((x, i) => <li key={i}><span className={`sd-badge ${x.ok ? "ok" : "bad"}`}>{x.status ?? "error"}</span><span className="mono sd-break">{x.url}</span><span className="sd-muted">try {x.attempt}{x.ms !== undefined ? ` · ${x.ms} ms` : ""}{x.error ? ` · ${x.error}` : ""}</span></li>)}</ul>}
            </section>
          )}
        </div>
      )}
    </>
  );
}

/* ================================================================== settings */
function Settings({ cfg, token, name, onSaved }: { cfg: Config; token: string; name: string | null; onSaved: (n: string) => void }) {
  const bal=useBalance(cfg);
  const [v, setV] = useState(name ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (name) setV(name); }, [name]);
  const save = async () => { setBusy(true); try { const p = await api.setProfile(cfg.merchant, v.trim(), token); onSaved(p.name ?? ""); toast("Business name saved. Your checkout shows it now."); } catch (e) { toast(msgOf(e), "err"); } finally { setBusy(false); } };
  return (
    <>
      <PageHead title="Settings" />
      <section className="sd-panel narrow">
        <h2>Public details</h2>
        <label className="sd-label" htmlFor="bn">Business name</label>
        <div className="sd-row"><input id="bn" className="sd-input" maxLength={48} value={v} placeholder="Takumi Coffee" onChange={(e) => setV(e.target.value)} /><button className="sd-btn primary" disabled={!token || busy || !v.trim() || v.trim() === name} onClick={save}>{busy ? <span className="spin" /> : "Save"}</button></div>
        <p className="sd-help">Shown on your checkout. Your payout account and each payer are public on NEAR testnet.</p>
      </section>
      <section className="sd-panel narrow">
        <h2>Settlement</h2>
        <dl className="sd-dl">
          <dt>Payout address</dt><dd className="mono">{short(bal.payout ?? cfg.merchant, 10)} <Copy text={bal.payout ?? cfg.merchant} /></dd>
          <dt>Asset</dt><dd>USDC (6 decimals)</dd>
          <dt>Privacy</dt><dd>Not integrated; these are public test-token payments.</dd>
          <dt>Pricing</dt><dd>test USDC only; no fiat conversion adapter</dd>
        </dl><button className="sd-btn primary" disabled={!token||busy} onClick={async()=>{setBusy(true);try{await api.connectShop(cfg.merchant,token);toast('Aubelle is connected to this merchant.')}catch(e){toast(msgOf(e),'err')}finally{setBusy(false)}}}>Connect Aubelle demo shop</button>
      </section>
    </>
  );
}

/* ================================================================== command palette */
function Palette({ rows, onClose, onCreate }: { rows: Row[]; onClose: () => void; onCreate: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const pages: [string, string][] = [["Home", "#/dashboard"], ["Balances", "#/dashboard/balances"], ["Payments", "#/dashboard/payments"], ["Payment links", "#/dashboard/links"], ["API keys", "#/dashboard/developers"], ["Webhooks", "#/dashboard/developers/webhooks"], ["Events", "#/dashboard/developers/events"], ["Settings", "#/dashboard/settings"]];
  const ql = q.toLowerCase();
  const items: { label: string; hint: string; run: () => void }[] = [
    { label: "Create payment link", hint: "Action", run: onCreate },
    ...pages.filter(([t]) => t.toLowerCase().includes(ql)).map(([t, h]) => ({ label: t, hint: "Go to", run: () => { go(h); onClose(); } })),
    ...rows.filter((x) => !q || [x.invoice.invoiceId, x.description, x.paymentTx, usdc(x.invoice.amount)].some((v) => v && String(v).toLowerCase().includes(ql))).slice(0, 8).map((x) => ({ label: `${usdc(x.invoice.amount)} USDC · ${x.description || short(x.invoice.invoiceId, 8)}`, hint: STATUS[x.status]?.[0] ?? x.status, run: () => { go(`#/dashboard/payments/${x.invoice.invoiceId}`); onClose(); } })),
  ].filter((it) => !q || it.label.toLowerCase().includes(ql) || it.hint === "Succeeded" || it.hint === "Refunded" || it.hint === "Incomplete" || it.hint === "Link sent" || it.hint === "Expired");
  useEffect(() => setI(0), [q]);
  return (
    <div className="sd-modal-bg top" onMouseDown={onClose}>
      <div className="sd-palette" role="dialog" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Search payments, pages and actions…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
          else if (e.key === "Enter") items[i]?.run();
          else if (e.key === "Escape") onClose();
        }} aria-label="Search" />
        <ul>{items.length === 0 ? <li className="sd-muted pad">Nothing matches “{q}”.</li> : items.map((it, k) => <li key={it.label + k}><button aria-current={k === i} onMouseEnter={() => setI(k)} onClick={it.run}><span>{it.label}</span><em>{it.hint}</em></button></li>)}</ul>
        <footer className="mono"><span>↑↓ to move</span><span>↵ to open</span><span>esc to close</span></footer>
      </div>
    </div>
  );
}
