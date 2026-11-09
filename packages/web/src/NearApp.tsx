import { useEffect, useMemo, useState } from "react";
import { nearView, quoteDeposit, quoteSpend, rheaRates, supportedStockTokens, supportedTokens, type Token } from "@noren/near-sdk";
import "./near.css";

const contract = import.meta.env.VITE_NEAR_TESTNET_CONTRACT as string | undefined;
const usdcNear = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const assets = ["BTC", "ZEC", "ETH", "SOL"];
type Position = { debt: string; limit: string; health: string; collateral: string };
const fmtUsd = (raw: string) => (Number(raw) / 1e6).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function NearApp() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [ratesError, setRatesError] = useState("");
  const [account, setAccount] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [positionError, setPositionError] = useState(contract ? "" : "Setup required: VITE_NEAR_TESTNET_CONTRACT");
  const [origin, setOrigin] = useState("BTC");
  const [amount, setAmount] = useState("0.0001");
  const [spendAmount, setSpendAmount] = useState("1");
  const [refund, setRefund] = useState("");
  const [merchant, setMerchant] = useState("");
  const [destination, setDestination] = useState("base");
  const [quote, setQuote] = useState<unknown>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);
  useEffect(() => {
    let alive = true;
    supportedTokens().then(list => { if (alive) setTokens(list); })
      .catch(e => { if (alive) setLoadError(e instanceof Error ? e.message : String(e)); });
    rheaRates().then(liveRates => { if (alive) setRates(Object.fromEntries(liveRates.map(x => [x.token, x.supply_apy]))); })
      .catch(e => { if (alive) setRatesError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);
  const stockCount = useMemo(() => supportedStockTokens(tokens).length, [tokens]);
  const selected = tokens.find(t => t.symbol === origin && t.blockchain === origin.toLowerCase());
  const nearRepresentation = tokens.find(t => t.symbol === origin && t.blockchain === "near");
  const outUsdc = tokens.find(t => t.symbol === "USDC" && t.blockchain === destination);
  const nearAccountValid = /^[a-z0-9._-]+$/.test(account);
  async function readPosition() {
    setPositionError(""); setPosition(null);
    if (!contract) { setPositionError("Setup required: VITE_NEAR_TESTNET_CONTRACT"); return; }
    if (!nearAccountValid) { setPositionError("Enter a NEAR account."); return; }
    try {
      const [debt, limit, health, collateral] = await Promise.all([
        nearView<string>(contract, "debt", { borrower: account }),
        nearView<string>(contract, "credit_limit", { borrower: account }),
        nearView<string>(contract, "health_bps", { borrower: account }),
        nearRepresentation ? nearView<string>(contract, "collateral_of", { borrower: account, token: nearRepresentation.contractAddress }) : Promise.resolve("0"),
      ]);
      setPosition({ debt, limit, health, collateral });
    } catch (e) { setPositionError(e instanceof Error ? e.message : String(e)); }
  }
  async function getQuote(kind: "deposit" | "spend") {
    setQuote(null); setQuoteError(""); setLoadingQuote(true);
    try {
      if (!nearAccountValid) throw new Error("Enter your NEAR account first.");
      if (kind === "deposit") {
        if (!selected || !nearRepresentation) throw new Error("No live 1Click token pair for this asset.");
        if (!refund) throw new Error("Enter a refund address on the origin chain.");
        const raw = BigInt(Math.round(Number(amount) * 10 ** selected.decimals)).toString();
        setQuote(await quoteDeposit(selected.assetId, nearRepresentation.assetId, raw, account, refund));
      } else {
        if (!outUsdc) throw new Error("Destination USDC is not in the live 1Click list.");
        if (!merchant) throw new Error("Enter the merchant's address.");
        const raw = BigInt(Math.round(Number(spendAmount) * 1e6)).toString();
        setQuote(await quoteSpend(usdcNear, outUsdc.assetId, raw, merchant, account));
      }
    } catch (e) { setQuoteError(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingQuote(false); }
  }
  const rate = nearRepresentation?.contractAddress && rates[nearRepresentation.contractAddress];
  return <div className="near-page">
    <header className="near-nav"><a className="near-brand" href="#/near">NOREN<span> / NEAR</span></a><nav><a href="#/near" onClick={e => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }}>How it works</a><a href="#/near" onClick={e => { e.preventDefault(); document.getElementById("position")?.scrollIntoView({ behavior: "smooth" }); }}>Credit line</a><a href="#/">Original Noren</a></nav></header>
    <main>
      <section className="near-hero">
        <div className="near-kicker"><span className="near-dot" /> NEAR HACKATHON EDITION <span>01 / CROSS-CHAIN CREDIT</span></div>
        <div className="near-hero-grid"><div><h1>Don’t sell.<br/><em>Spend.</em></h1><p>Keep your BTC, ZEC or ETH. Explore a credit line on NEAR and live cross-chain payment quotes while the mainnet settlement loop is wired.</p><a className="near-primary" href="#/near" onClick={e => { e.preventDefault(); document.getElementById("position")?.scrollIntoView({ behavior: "smooth" }); }}>Explore your credit line <span>↗</span></a></div>
          <div className="near-orbit" aria-hidden="true"><span>BTC</span><span>ZEC</span><strong>N</strong><span>ETH</span><span>SOL</span><small>ANY CHAIN IN<br/>ANY CHAIN OUT</small></div></div>
        <div className="near-ticker"><span>YOUR COINS ON EVERY CHAIN</span><span>✦</span><span>PAY ANYONE, ANYWHERE</span><span>✦</span><span>DEBT FREE IS A PROJECTION</span></div>
      </section>
      <section className="near-section" id="how"><div className="near-section-head"><span>01 — THE IDEA</span><h2>Keep the asset.<br/>Use the value.</h2></div>
        <div className="near-steps"><article><b>01</b><h3>Bring collateral</h3><p>1Click can quote a route from the origin chain to a NEAR representation. Credit starts only after a verified NEP-141 deposit to Noren.</p></article><article><b>02</b><h3>Draw credit</h3><p>The on-chain LTV limit and fresh oracle price bound USDC borrowing. The current contract pays a NEAR account.</p></article><article><b>03</b><h3>Repay and release</h3><p>Repayment reduces debt. A trusted yield transfer can also pay debt down. Actual Rhea supply and cross-chain withdrawal remain in setup.</p></article></div>
      </section>
      <section className="near-workspace" id="position"><div className="near-section-head"><span>02 — YOUR POSITION</span><h2>Credit, in the clear.</h2></div>
        <div className="near-panel"><div className="near-panel-top"><label>Your NEAR account<input value={account} onChange={e => setAccount(e.target.value.trim())} placeholder="you.near or you.testnet" /></label><button onClick={readPosition}>Read testnet position ↗</button></div>
          {positionError && <p className="near-alert" role="alert">{positionError}</p>}
          {!position && !positionError && <p className="near-empty">No position loaded. Enter an account to read the live testnet contract.</p>}
          {position && <div className="near-metrics"><div><span>CREDIT LIMIT</span><strong>{fmtUsd(position.limit)}</strong></div><div><span>OUTSTANDING</span><strong>{fmtUsd(position.debt)}</strong></div><div><span>HEALTH</span><strong>{position.debt === "0" ? "No debt" : (Number(position.health) / 1e4).toFixed(2) + "×"}</strong></div></div>}
          <div className="near-projection"><span>DEBT-FREE ON</span><strong>Awaiting earned yield</strong><p>A date appears only when live collateral supply, harvested yield and debt are verified. Estimates are projections, never a repayment promise.</p></div>
        </div>
      </section>
      <section className="near-section near-routes"><div className="near-section-head"><span>03 — LIVE ROUTES</span><h2>Quote the path.</h2></div>
        {loadError && <p className="near-alert" role="alert">1Click data unavailable: {loadError}</p>}
        {ratesError && <p className="near-alert" role="alert">Rhea rates unavailable: {ratesError}</p>}
        <div className="near-route-grid"><article className="near-card"><span>COLLATERAL IN</span><h3>From your chain</h3><label>Asset<select value={origin} onChange={e => setOrigin(e.target.value)}>{assets.map(x => <option key={x}>{x}</option>)}</select></label><label>Amount<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" /></label><label>Origin refund address<input value={refund} onChange={e => setRefund(e.target.value)} placeholder="Address on source chain" /></label><button disabled={loadingQuote || !tokens.length} onClick={() => getQuote("deposit")}>Get live dry quote ↗</button><p>Quote only. To receive credit, withdraw the resulting Intents balance to your NEAR account and transfer it to the Noren contract. SOL has no verified NEAR collateral representation here.</p></article>
          <article className="near-card"><span>MERCHANT OUT</span><h3>Pay anyone, anywhere</h3><label>Destination<select value={destination} onChange={e => setDestination(e.target.value)}><option value="base">Base</option><option value="arb">Arbitrum</option></select></label><label>USDC amount<input value={spendAmount} onChange={e => setSpendAmount(e.target.value)} inputMode="decimal" /></label><label>Merchant address<input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="0x…" /></label><button disabled={loadingQuote || !tokens.length} onClick={() => getQuote("spend")}>Quote USDC payment ↗</button><p>Dry quote only. Funding and execution require a funded mainnet account and a connected wallet.</p></article></div>
        {quoteError && <p className="near-alert" role="alert">{quoteError}</p>}
        {quote !== null && <details className="near-quote" open><summary>Live dry quote · {new Date().toLocaleTimeString()}</summary><pre>{JSON.stringify(quote, null, 2)}</pre></details>}
      </section>
      <section className="near-bottom"><div><span>04 — THE HONEST STATUS</span><h2>Built for the chain.<br/>Waiting on the loop.</h2></div><div><p>Live catalog: {tokens.length ? `${tokens.length} assets` : "Loading…"}. Tokenised stocks reachable: {tokens.length ? stockCount : "checking"}. {rate ? `Rhea ${origin} representation supply APY: ${rate}% observed now.` : "Rhea yield varies by representation."}</p><p className="near-alert">Setup required: NEAR_MAINNET_ACCOUNT for a real 1Click deposit, merchant payment and withdrawal.</p><p>Pay in 3 is scheduled on-chain for NEAR recipients. A keeper must execute each due instalment; cross-chain auto payment is not connected.</p></div></section>
    </main><footer className="near-footer"><span>NOREN / NEAR</span><span>Keep your coins. Know the limits.</span><a href="https://github.com/nickthelegend/noren">Source ↗</a></footer>
  </div>;
}
