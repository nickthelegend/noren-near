import { useMemo } from "react";
import { GlyphField, useReveal } from "../Landing";
import { Icon, Logo } from "../ui";
import { Mark } from "../logos";
import { MeltChart } from "./Melt";
import {
  CONTRACT, COLLATERAL, DEMO, HOME_COINS, RECORD, SAVED_QUOTES, STOCK_RE, ago, explorerAccount, healthLabel, meltCurve, nsToMs,
  short, shortHash, usd6, useAssets, usePool, usePosition, useRates, useTokens,
} from "./data";
import "../landing.css";
import "./near.css";

type Status = "testnet" | "quotes" | "proj" | "blocked" | "key";
const LABEL: Record<Status, string> = { testnet: "Live on NEAR testnet", quotes: "Live mainnet quotes", proj: "Projection", blocked: "Blocked on testnet", key: "Setup required" };
const Chip = ({ s }: { s: Status }) => <span className={`nx-chip ${s === "testnet" ? "testnet" : s === "quotes" ? "quotes" : s === "key" ? "key" : "wip"} mono`}><i />{LABEL[s]}</span>;
const Tag = ({ children, dark }: { children: string; dark?: boolean }) => <span className={`lx-tag mono ${dark ? "dark" : ""}`}>■ {children}</span>;

/** The lifecycle steps worth showing first, in the order they ran on testnet. */
const PROOF = [
  { match: "deploy credit", t: "Contract deployed", d: "noren_credit on its own sub-account" },
  { match: "alice deposits", t: "Collateral in", d: "0.01 test WBTC via ft_transfer_call" },
  { match: "relayer posts signed BTC-USD price", t: "Signed price checked", d: "Coinbase BTC-USD, ed25519 on-chain" },
  { match: "alice pays shop", t: "Paid a merchant on credit", d: "25 test USDC straight to the shop" },
  { match: "alice repays", t: "Repaid in full", d: "Overpayment refunded by NEP-141" },
  { match: "alice withdraws", t: "Collateral back", d: "0.01 test WBTC returned" },
  { match: "attack: forged relayer signature", t: "Forged price rejected", d: "Wrong key, 10× price: reverted" },
  { match: "attack: forged ft_on_transfer", t: "Fake deposit rejected", d: "Direct callback call: reverted" },
];

export function NearLanding() {
  const ref = useReveal();
  const tokens = useTokens(), rates = useRates(), assets = useAssets(), pool = usePool(), bob = usePosition(DEMO.open);
  const steps = useMemo(() => PROOF.map((p) => ({ ...p, s: RECORD.steps.find((s) => s.step.startsWith(p.match)) })).filter((p) => p.s), []);
  const btc = assets.data?.find((a) => a.token === COLLATERAL);
  const chains = useMemo(() => new Set((tokens.data ?? []).map((t) => t.blockchain)).size, [tokens.data]);
  const stocks = useMemo(() => (tokens.data ?? []).filter((t) => STOCK_RE.test(t.symbol)), [tokens.data]);
  const wbtcApy = rates.data?.find((r) => r.token === "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near")?.supply_apy;
  const pos = bob.data;
  const debt = pos ? Number(BigInt(pos.debt_usd6)) / 1e6 : 0, coll = pos ? Number(BigInt(pos.collateral_usd6)) / 1e6 : 0;
  const melt = pos && wbtcApy !== undefined && pool.data ? meltCurve(debt, coll, Number(wbtcApy), pool.data.aprBps) : null;

  return (
    <div className="lp nl" ref={ref} onClick={(e) => {
      // In-page anchors must not change the hash: the hash is the router.
      const h = (e.target as HTMLElement).closest("a")?.getAttribute("href");
      if (h && h.startsWith("#") && !h.startsWith("#/")) { e.preventDefault(); document.getElementById(h.slice(1))?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
    }}>
      <header className="site-nav solid nl-nav">
        <a className="site-brand" href="#/near"><Logo size={26} /><span>Noren</span><span className="nl-ed mono">NEAR</span></a>
        <nav className="mono">
          <a href="#coins">Coins</a>
          <a href="#how">How it works</a>
          <a href="#proof">Testnet proof</a>
          <a href="#/">Noren on Arc</a>
        </nav>
        <a className="lx-btn light sm" href="#/near/app">Open app <Icon.arrow /></a>
      </header>

      {/* ---------------------------------------------------------------- hero */}
      <section className="lx-hero nl-hero">
        <GlyphField />
        <div className="lx-hero-in">
          <span className="lx-pill mono"><i />NEAR Hackathon edition · live on NEAR testnet</span>
          <h1>Don’t sell your Bitcoin. <em>Spend against it,</em> anywhere.</h1>
          <p>Borrow test USDC against test WBTC on NEAR testnet and pay a merchant directly. Cross-chain routes are dry quotes; using yield to repay debt is a projection.</p>
          <div className="lx-ctas">
            <a className="lx-btn light" href="#/near/app">Open the credit app</a>
            <a className="lx-btn dark" href="#proof">See the testnet run</a>
          </div>
        </div>
        <div className="lx-horizon" aria-hidden />
      </section>

      {/* ---------------------------------------------------------------- live strip: the recorded testnet run */}
      <section className="nx-live" aria-label="Recorded on NEAR testnet">
        <div className="nx-live-in">
          <span className="nx-live-h mono"><i aria-hidden />One full credit cycle, signed on NEAR testnet</span>
          <ul>
            {steps.map((p) => (
              <li key={p.match}><a href={p.s!.explorer} target="_blank" rel="noreferrer">
                <span className={`nl-dot ${p.s!.status}`} aria-hidden>{p.s!.status === "success" ? <Icon.check /> : <Icon.x />}</span>
                <span><b>{p.t}</b><small>{p.d} · <span className="mono">{shortHash(p.s!.hash)}</span></small></span><Icon.ext />
              </a></li>
            ))}
          </ul>
          <p className="mono">Each card opens the transaction on testnet.nearblocks.io. {RECORD.steps.length} transactions in <a href="https://github.com/nickthelegend/noren/blob/near/deployments/testnet-2026-11-09.json">deployments/testnet-2026-11-09.json</a>. The two red ones are attacks the contract rejected.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- coins on every chain */}
      <section className="nx-sec" id="coins">
        <div className="nx-head split" data-reveal>
          <div><Tag>Your coins on every chain</Tag><h2>Keep the coin. <span>Borrow against what it’s worth today.</span></h2></div>
          <p>Prices below are NEAR Intents 1Click’s live mainnet catalog. Credit is shown at the contract’s 50% LTV, so one coin opens half its value as a line.</p>
        </div>
        <div className="nl-coins" data-reveal>
          {HOME_COINS.map((c) => {
            const t = tokens.data?.find((x) => x.symbol === c.symbol && x.blockchain === c.chain);
            return (
              <article key={c.symbol} className="nl-coin">
                <header><Mark id={c.symbol} size={36} /><span><b>{c.name}</b><small className="mono">{c.symbol} · on {c.name}</small></span></header>
                <strong>{t?.price ? t.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: t.price > 100 ? 0 : 2 }) : tokens.error ? "Unavailable" : "Loading…"}</strong>
                <p>{t?.price ? <>1 {c.symbol} opens <b>{(t.price / 2).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</b> of credit</> : tokens.error ? tokens.error : "Reading the 1Click catalog"}</p>
                <footer className="mono">{t ? <span className="mono">{t.assetId.replace("nep141:", "")}</span> : "—"}</footer>
              </article>
            );
          })}
        </div>
        <p className="nx-legend" data-reveal>
          <Chip s="quotes" />
          {tokens.data ? <span>{tokens.data.length} assets on {chains} chains in the 1Click catalog right now. Tokenised stocks listed: {stocks.length ? stocks.map((s) => s.symbol).join(", ") : "none"}, so Noren on NEAR does not offer stock collateral.</span> : <span>{tokens.error ?? "Loading the live catalog…"}</span>}
        </p>
      </section>

      {/* ---------------------------------------------------------------- how it works */}
      <section className="nx-sec" id="how">
        <div className="nx-head" data-reveal><Tag>How it works</Tag><h2>Four steps. <span>Lock, draw, pay, and let the yield melt the debt.</span></h2></div>
        <ol className="nl-how">
          {[
            { n: "01", t: "Lock test WBTC", s: ["testnet", "key"] as Status[], d: "Collateral counts only when a token contract calls ft_on_transfer on Noren. Testnet uses public test WBTC. Mainnet deposits through 1Click still need an attribution adapter." },
            { n: "02", t: "See your limit", s: ["testnet"] as Status[], d: "Limit = collateral × price × 50% LTV. The testnet price is a Coinbase spot signed by Noren’s relayer and verified with ed25519 inside the contract. Stale for 90 s means no borrowing." },
            { n: "03", t: "Pay anyone, anywhere", s: ["testnet", "quotes"] as Status[], d: "A draw pays test USDC straight to a merchant’s NEAR account. 1Click quotes Base or Arbitrum routes live; execution needs a funded mainnet account and a payout adapter." },
            { n: "04", t: "The debt melts", s: ["proj", "blocked"] as Status[], d: "A future Rhea adapter would turn earned yield into USDC for repayment. Today, only the contract’s yield input is sandbox-tested; the debt-free date is a projection." },
          ].map((x, i) => (
            <li key={x.n} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="nx-num mono">{x.n}</span>
              <h3>{x.t}</h3>
              <p>{x.d}</p>
              <div className="nl-chips">{x.s.map((s) => <Chip key={s} s={s} />)}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- debt melts */}
      <section className="nx-sec" id="melt">
        <div className="nl-melt" data-reveal>
          <div className="nl-melt-copy">
            <Tag>Debt-free on</Tag>
            <h2>{melt?.payoff ? <>{melt.payoff.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</> : melt ? "Not at today’s rates" : bob.error || rates.error || (rates.data && wbtcApy === undefined) ? "Unavailable" : "Reading…"}</h2>
            <p>The open demo loan on testnet, <a className="mono" href={explorerAccount(DEMO.open)} target="_blank" rel="noreferrer">{short(DEMO.open)}</a>: {usd6(pos?.debt_usd6)} owed against {usd6(pos?.collateral_usd6)} of test WBTC, at the contract’s {pool.data ? pool.data.aprBps / 100 : "…"}% APR.</p>
            <p>If that collateral earned Rhea’s live WBTC supply rate ({wbtcApy !== undefined ? `${wbtcApy}%` : rates.error ? "unavailable" : "…"}), monthly harvests would clear it on the date above.</p>
            <div className="nl-chips"><Chip s="proj" /><Chip s="blocked" /></div>
          </div>
          <div className="nl-melt-chart">{pos && melt ? <MeltChart debtUsd={debt} collateralUsd={coll} supplyApy={Number(wbtcApy)} aprBps={pool.data!.aprBps} tone="night" /> : <div className="nl-wait mono">{bob.error ?? rates.error ?? "Loading the live position and rate…"}</div>}</div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- live numbers */}
      <section className="nx-sec" id="proof">
        <div className="nx-head split" data-reveal>
          <div><Tag>Live from the contract</Tag><h2>Read from NEAR testnet <span>when this page loaded.</span></h2></div>
          <p><a className="mono" href={explorerAccount(CONTRACT)} target="_blank" rel="noreferrer">{CONTRACT}</a>. Views refresh every 30 s.</p>
        </div>
        <div className="nx-num-grid" data-reveal>
          <div><b>{pool.data ? usd6(pool.data.liquidity, 0) : "—"}</b><span>test USDC available to borrow in the pool</span></div>
          <div><b>{pool.data ? `${(pool.data.utilizationBps / 100).toFixed(1)}` : "—"}<em>%</em></b><span>pool utilisation</span></div>
          <div><b>{pool.data ? `${pool.data.aprBps / 100}` : "—"}<em>% APR</em></b><span>borrow rate, accrued per second</span></div>
          <div><b>{btc ? usd6(btc.price_usd6, 0) : "—"}</b><span>BTC relayer price (testnet), {btc ? `signed ${ago(nsToMs(btc.price_at_ns))}` : "loading"}</span></div>
          <div><b>{pos ? healthLabel(pos.health_bps) : "—"}</b><span>health of the open demo loan (1.00× = liquidatable)</span></div>
          <div><b>{RECORD.steps.length}</b><span>signed testnet transactions recorded, attacks included</span></div>
        </div>
        <p className="nx-note mono" data-reveal>{pool.error || assets.error || bob.error ? `Read error: ${pool.error ?? assets.error ?? bob.error}` : btc && !btc.price_fresh ? "The relayer price is older than 90 s, so borrowing is paused until the next post (pnpm near:relay). Repaying always works." : "Prices fresh: borrowing open."}</p>
      </section>

      {/* ---------------------------------------------------------------- NEAR tech */}
      <section className="nx-built">
        <div className="nx-built-in">
          <div className="nx-head" data-reveal><Tag dark>What NEAR does here</Tag><h2>The NEAR features doing the work. <span>Named, with what each one is for.</span></h2></div>
          <ul className="nx-built-list">
            {[
              { b: "NEP-141 transfer callbacks", p: "Collateral, pool deposits and repayments arrive only through ft_on_transfer from the token contract, so a direct call cannot invent a deposit.", s: "testnet" as Status },
              { b: "ed25519_verify in the contract", p: "The relayer signs contract | token | price | exchange timestamp | source URL. The contract checks the key, the 90 s age and that each price is newer than the last.", s: "testnet" as Status },
              { b: "Promises with a per-user lock", p: "Borrow, withdraw and liquidation move state first, transfer, then settle in a private callback keyed by a nonce; a failed transfer restores everything.", s: "testnet" as Status },
              { b: "Sub-accounts", p: "credit., alice., bob. and shop. live under one root account, so the whole demo is one namespace on the explorer.", s: "testnet" as Status },
              { b: "NEAR Intents 1Click", p: `Any-chain in and out. ${SAVED_QUOTES.quotes.length} dry: true quotes saved at ${new Date(SAVED_QUOTES.observedAt).toUTCString().slice(5, 22)} UTC, including ZEC in and Base and Arbitrum out.`, s: "quotes" as Status },
              { b: "Rhea lending as the yield source", p: "Supply APY per market is read live from Rhea. Supplying and harvesting still need a mainnet yield adapter and a funded account.", s: "key" as Status },
            ].map((x) => (
              <li key={x.b} data-reveal><b>{x.b}</b><p>{x.p}</p><Chip s={x.s} /></li>
            ))}
          </ul>
          <p className="nx-built-foot mono">Noren also exists on Arc and Robinhood Chain. Only this NEAR integration (branch near) is the hackathon entry.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- cta */}
      <section className="nx-cta">
        <h2>Run the cycle yourself.</h2>
        <p>Five sandbox tests on a real nearcore node, the testnet lifecycle with every hash saved, a fresh signed Coinbase price, and 1Click dry quotes.</p>
        <pre className="mono">{`pnpm near:test\npnpm near:testnet\npnpm near:relay\npnpm near:quotes`}</pre>
        <div className="lx-ctas"><a className="lx-btn light" href="#/near/app">Open the credit app</a><a className="lx-btn dark" href="https://github.com/nickthelegend/noren/compare/main...near">Read the diff</a></div>
        <p className="nl-setup mono">Mainnet deposits, merchant payouts and harvests: {SAVED_QUOTES.mainnetExecution}</p>
      </section>
    </div>
  );
}
