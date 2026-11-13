// Original ETHGlobal landing components and artwork. NEAR claims come from the native contract and deployment evidence.
import {useEffect,useRef,useState} from 'react';import{Icon}from'./ui';import{Mark}from'./logos';import'./landing.css';
type Status='live'|'wip'|'quotes'|'testnet'|'key'|'local';const STATUS:Record<Status,string>={live:'NEAR testnet',wip:'Not integrated',quotes:'Mainnet dry quote',testnet:'NEAR testnet',key:'Operator authorization',local:'Local service'};
const Chip=({s}:{s:Status})=><span className={`nx-chip ${s} mono`}><i/>{STATUS[s]}</span>;
const CODE:Record<string,{file:string;lines:[string,string][]}>={
 link:{file:'server.ts',lines:[['c','// Keep the secret key on your server'],['','const r = await fetch(api + "/merchants/" + merchant + "/invoices", {'],['','  method: "POST",'],['','  headers: { "content-type": "application/json",'],['','    authorization: "Bearer " + process.env.NOREN_SECRET_KEY },'],['','  body: JSON.stringify({ amount: "7500000", description: "Flat white" })'],['','});'],['','const { invoice } = await r.json();'],['s','// Send the customer to /#/pay/ + invoice.invoiceId']]},
 read:{file:'receipt.ts',lines:[['c','// Poll the service after the customer payment'],['','const r = await fetch(api + "/invoices/" + invoiceId);'],['','const receipt = await r.json();'],['','if (receipt.status === "paid") fulfilOrder();'],['s','// Status changes only after matching FINAL NEAR execution.'],['c','// The payer and amount are public; this is not private checkout.']]},
 pay:{file:'checkout.ts',lines:[['c','// Signed by the customer with Meteor on NEAR testnet'],['','// Pay with TEST stock: an actual sale for test USDC.'],['','// Or deposit TEST stock first, then borrow straight to the shop.'],['','// Pay in 3 schedules three draws; scheduling sends no money.'],['s','// Inspect every finalized transaction on testnet.nearblocks.io.']]}
};
const SURFACES=[
 {k:'merchant',name:'Noren Merchant',href:'#/dashboard',cta:'Open Noren Merchant',img:'/art/iso-merchant.jpg',w:1200,h:750,line:'Sign in with Meteor, create a business, issue API keys and payment links, and inspect verified NEAR receipts.',cap:'Noren brand illustration; open the working local merchant service.'},
 {k:'app',name:'Noren app',href:'#/app',cta:'Open the Noren app',img:'/art/render-credit.jpg',w:500,h:1040,line:'Home, Pay, Earn, Credit, Borrow and Swap. Native TEST stocks and BTC collateral on one chain: NEAR testnet.',cap:'Noren brand illustration; test assets are not real shares.'},
 {k:'sdk',name:'Aubelle × Noren',href:'/shop/',cta:'Shop the demo',img:'/art/iso-shop.jpg',w:1200,h:750,line:'The original Aubelle demo boutique, with a bag and Noren checkout. Stocks lead; every payment is a public testnet payment.',cap:'Noren brand illustration; the demo shop sells no real goods.'}
];
type Power={k:string;t:string;s:Status[];d:string;m?:string;art?:string;alt?:string;tone?:'dark'};
const POWERS:Power[]=[
 {k:'stocks',t:'Pay with test stocks',s:['testnet'],d:'Sell native TEST tTSLA, tNVDA or tAAPL to a separately funded buyer. The merchant gets test USDC. Test tokens are not real company shares.',m:'Signed price required · 90-second lifetime'},
 {k:'earn',t:'Keep your Tesla. Buy the thing.',s:['testnet'],art:'/art/render-earn.jpg',alt:'Original Noren vault illustration',tone:'dark',d:'Deposit TEST stock or test BTC without selling it. Stocks unlock 40% of their priced value; BTC 50%. Borrow test USDC straight to a named NEAR merchant account. Repay, then withdraw your collateral. These deposits do not earn yield.'},
 {k:'in3',t:'Pay in 3',s:['testnet'],d:'Schedule three monthly credit draws. The first can be drawn now; the next two are due after 30 and 60 days. A schedule pays nothing by itself. Every draw needs fresh prices and credit headroom; no keeper is running.',m:'Merchant receives only each successful due draw'},
 {k:'private',t:'Pay privately',s:['wip'],art:'/art/iso-privacy.jpg',alt:'Original Noren curtain illustration, not a privacy proof',d:'Private payments remain Noren’s goal. This NEAR edition does not integrate a privacy mechanism: the payer, amount and merchant are public. The checkout says so before a payment.'},
 {k:'borrow',t:'A real NEAR credit position',s:['testnet'],d:'One deployed NEAR contract holds multiple collateral tokens, verifies signed prices, enforces each asset’s LTV and records debt and health. Health below one allows liquidation. Repayment and debt-free withdrawal remain available when prices are stale.'},
 {k:'bridge',t:'Bring coins',s:['quotes'],art:'/art/iso-bridge.jpg',alt:'Original Noren funding illustration',d:'BTC, ETH, SOL and ZEC controls request real NEAR Intents 1Click mainnet dry quotes. Nothing moves on testnet. Real funding requires mainnet assets, a funded NEAR account and a deposit-attribution adapter.'}
];
const BUILT:{name:string;logos:string[];use:string;s:Status;note?:string}[]=[
 {name:'Native NEAR credit',logos:[],use:'Named shop accounts receive test USDC directly from credit draws. NEP-141 callbacks credit collateral; finalized receipts verify payment.',s:'testnet'},
 {name:'NEP-141 TEST stocks',logos:['TSLA','NVDA','AAPL'],use:'Native tTSLA, tNVDA and tAAPL. Eight decimals; test tokens with no value, not real shares.',s:'testnet'},
 {name:'Signed public equity quotes',logos:[],use:'Yahoo Finance by default; Pyth when PYTH_API_KEY is configured in the operator environment. Original publication time is preserved. Noren’s relayer signature is checked on-chain.',s:'testnet',note:'A relayer attestation, not a Yahoo/Pyth on-chain proof. Stale quotes block new borrowing and sales.'},
 {name:'Meteor Wallet',logos:[],use:'Testnet wallet approval, pending state, FINAL execution and public explorer receipts. Merchant sign-in uses a verified NEP-413 message.',s:'testnet'},
 {name:'NEAR Intents 1Click',logos:[],use:'Mainnet dry arrival estimates for BTC, ETH, SOL and ZEC. No mainnet execution or testnet deposit is claimed.',s:'quotes'},
 {name:'Merchant service',logos:[],use:'Local persistent businesses, hashed API keys and invoice links. Payment status is verified against invoice-bound FINAL NEAR transactions. Metadata is not an on-chain registration.',s:'local'}
];
const LIVE_STRIP=[{t:'Stock-backed shop payment',d:'25 test USDC; deposited stock was kept',href:'https://testnet.nearblocks.io/txns/Gg9NtgpJyhkfQLhoFDUUgfp1krCbW2HmEABCWRFo95ho',marks:['TSLA','USDC']},{t:'Repayment and collateral return',d:'The same TEST tTSLA was withdrawn',href:'https://testnet.nearblocks.io/txns/9GeFfZZAeCC29TvoNVobPR6bJixe4xQhcFhnbw42y2ES',marks:['TSLA']},{t:'Native credit contract',d:'NEAR testnet · public positions and payments',href:'https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet',marks:[]}];
const ONBOARD=[['Sign in and create your store','Connect Meteor on NEAR testnet, sign a NEP-413 message, name your store and choose its named NEAR payout account. Metadata stays in the local service.'],['Create a payment link','Price it in test USDC, then share the hosted checkout link. API secrets are shown once and stored hashed.'],['Inspect the payment receipt','Your merchant view changes only after matching FINAL NEAR execution. The amount, payer and transaction are public. Webhook delivery is not integrated.']];
const NUMBERS=[{v:'3',l:'native TEST stock tokens; not real shares'},{v:'40',u:'%',l:'stock collateral loan-to-value'},{v:'50',u:'%',l:'BTC collateral loan-to-value'},{v:'90',u:'s',l:'maximum quote age for new borrowing and stock sales'},{v:'1',l:'chain: NEAR testnet'},{v:'Public',l:'payments and positions; no privacy claim'}];
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Plays a muted ambient film only while it is on screen, and never under reduced motion. */
function Film({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: .25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} />;
}

/** A field of tiny noren marks that brightens toward a horizon, with a slow shimmer. Deterministic, cheap, pauses offscreen. */
function GlyphField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, visible = true, last = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2), cell = 15;
    const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const resize = () => { const r = c.getBoundingClientRect(); w = r.width; h = r.height; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now()); };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), time = reduce ? 0 : t / 1000;
      for (let j = 0; j < rows; j++) {
        const fy = j / rows;
        for (let i = 0; i < cols; i++) {
          const n = hash(i, j), cx = i / cols - .5;
          // vertical light: strongest near the horizon (bottom), shaped like a wide dome, rippled by a slow wave
          const dome = Math.max(0, 1 - (cx * cx) * 2.2 - Math.pow(1 - fy, 1.6) * 1.15);
          const wave = .55 + .45 * Math.sin(time * .8 + i * .21 + j * .13 + n * 6.28);
          // keep the copy legible: clear an ellipse behind the headline and paragraph
          const dx = cx / .3, dy = (fy - .5) / .26, hole = Math.min(1, Math.max(0, (dx * dx + dy * dy - .55) / .9));
          const a = dome * (n > .42 ? 1 : .25) * wave * hole;
          if (a < .04) continue;
          const x = i * cell + 4, y = j * cell + 4;
          ctx.fillStyle = `rgba(${150 + 90 * fy | 0}, ${185 + 60 * fy | 0}, 255, ${Math.min(1, a * 1.1)})`;
          ctx.fillRect(x, y, 1.6, 6); ctx.fillRect(x + 3, y, 1.6, 7); ctx.fillRect(x + 6, y, 1.6, 6);
        }
      }
    };
    const loop = (t: number) => { raf = requestAnimationFrame(loop); if (!visible || t - last < 50) return; last = t; draw(t); };
    resize(); addEventListener("resize", resize);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(c);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); io.disconnect(); };
  }, []);
  return <canvas ref={ref} className="lx-field" aria-hidden />;
}

const Tag = ({ children, dark }: { children: string; dark?: boolean }) => <span className={`lx-tag mono ${dark ? "dark" : ""}`}>■ {children}</span>;

export function Landing() {
  const [tab, setTab] = useState<keyof typeof CODE>("link");
  const ref = useReveal();
  return (
    <div className="lp" ref={ref}>
      {/* ---------------------------------------------------------------- hero (unchanged) */}
      <section className="lx-hero">
        <GlyphField />
        <div className="lx-hero-in">
          <span className="lx-pill mono"><i />Live on NEAR testnet · public payments</span>
          <h1>Stablecoins, stocks<br />or <em>credit.</em></h1>
          <p>Keep your Tesla. Buy the thing. Native TEST stocks, stablecoins and stock-backed credit for merchants on NEAR testnet. Payments are public here; private checkout is not integrated.</p>
          <div className="lx-ctas">
            <a className="lx-btn light" href="#/dashboard">Open dashboard</a>
            <a className="lx-btn dark" href="#developers">Read the API</a>
          </div>
        </div>
        <div className="lx-horizon" aria-hidden />
      </section>

      {/* ---------------------------------------------------------------- live on public testnets */}
      <section className="nx-live" aria-label="Live on public testnets">
        <div className="nx-live-in">
          <span className="nx-live-h mono"><i aria-hidden />Live on public testnets</span>
          <ul>
            {LIVE_STRIP.map((x) => (
              <li key={x.href}><a href={x.href} target="_blank" rel="noreferrer"><span className="nx-live-m" aria-hidden>{x.marks.map((m) => <Mark key={m} id={m} size={18} />)}</span><span><b>{x.t}</b><small>{x.d}</small></span><Icon.ext /></a></li>
            ))}
          </ul>
          <p className="mono">Every link opens a NEAR testnet explorer. These are public test-token transactions, not real shares or money.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- (a) what Noren is */}
      <section className="nx-one">
        <div className="nx-one-in">
          <div data-reveal><Tag dark>What Noren is</Tag></div>
          <h2 data-reveal>A shop gets paid. You keep your <em>stock.</em> <span>Credit against native TEST stocks on NEAR, with a signed price, an enforced borrowing limit and a receipt you can inspect.</span></h2>
          <figure className="nx-film" data-reveal>
            <Film src="/art/vault.mp4" poster="/art/vault-poster.jpg" label="Glossy coins drift behind a noren curtain; only a point of light reaches the vault" />
            <figcaption className="mono">Noren’s original curtain artwork. This is an illustration, not a privacy demonstration. <span>Film generated with Google Gemini (Veo); Gemini's mark is kept, bottom right.</span></figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------------------------------------------------------- (b) three surfaces */}
      <section className="nx-sec nx-surf" id="surfaces">
        <div className="nx-head" data-reveal>
          <Tag>One product, three surfaces</Tag>
          <h2>One Noren. <span>A dashboard for the shop, an app for the customer, an SDK for the developer.</span></h2>
        </div>
        <div className="nx-surf-grid">
          {SURFACES.map((s, i) => (
            <article key={s.k} className={`nx-surf-card ${s.k}`} data-reveal style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="nx-surf-copy">
                <span className="nx-num mono">0{i + 1}</span>
                <h3>{s.name}</h3>
                <p>{s.line}</p>
                <a className="nx-link mono" href={s.href}>{s.cta} <Icon.arrow /></a>
              </div>
              <figure className={`nx-shot ${s.k === "app" ? "phone" : "browser"}`}>
                {s.k !== "app" && <span className="nx-dots" aria-hidden><i /><i /><i /></span>}
                <img src={s.img} alt={`${s.name}: ${s.cap}`} width={s.w} height={s.h} loading="lazy" />
                <figcaption className="mono">{s.cap} </figcaption>
              </figure>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- (c) consumer powers */}
      <section className="nx-sec nx-powers" id="app">
        <div className="nx-head split" data-reveal>
          <div>
            <Tag>In the Noren app</Tag>
            <h2>Everything your money can do. <span>Each one says what runs today.</span></h2>
          </div>
          <p>Payments, stock sales and credit draws are public on NEAR. Private checkout is unavailable. Direct stock payment sells the stock; credit keeps deposited stock as collateral.</p>
        </div>
        <div className="nx-bento">
          {POWERS.map((p, i) => (
            <article key={p.k} className={`nx-pw ${p.k} ${p.tone ?? ""}`} data-reveal style={{ transitionDelay: `${(i % 4) * 60}ms` }}>
              <div className="nx-pw-top">{p.s.map((s) => <Chip key={s} s={s} />)}</div>
              <h3>{p.t}</h3>
              <p>{p.d}</p>
              {p.m && <span className="nx-pw-m mono">{p.m}</span>}
              {p.k === "in3" && <ol className="nx-in3 mono" aria-label="Three equal parts">{["First", "Part 2", "Last"].map((x) => <li key={x}><span>{x}</span><b>4.67</b></li>)}</ol>}
              {p.art && <img className="nx-pw-art" src={p.art} alt={p.alt} width={900} height={900} loading="lazy" />}
            </article>
          ))}
        </div>
        <p className="nx-legend mono"><Chip s="testnet"/> real native testnet execution. <Chip s="quotes"/> estimates only; no funds sent. <Chip s="wip"/> not integrated.</p>
      </section>

      {/* ---------------------------------------------------------------- (d) built with */}
      <section className="nx-built" id="built-with">
        <div className="nx-built-in">
          <div className="nx-head" data-reveal>
            <Tag dark>Built with</Tag>
            <h2>One job each. <span>Native contracts enforce the credit rules. Wallets sign. The relayer carries original market quotes. Named NEAR accounts receive the shop payment. Intents supplies dry funding estimates.</span></h2>
          </div>
          <ul className="nx-built-list">
            {BUILT.map((b, i) => (
              <li key={b.name} data-reveal style={{ transitionDelay: `${i * 50}ms` }}>
                <b className="nx-built-name"><span className="nx-built-logos">{b.logos.map((l) => <Mark key={l} id={l} size={24} />)}</span>{b.name}</b>
                <p>{b.use}{b.note && <small className="mono">{b.note}</small>}</p>
                <Chip s={b.s} />
              </li>
            ))}
          </ul>
          <div className="nx-built-chains"><span><b>Why NEAR</b><small>Named shop accounts, native NEP-141 collateral, wallet-signed calls and FINAL receipt verification. Intents adds mainnet dry funding estimates.</small></span></div>
          <p className="nx-built-foot mono">One chain: NEAR testnet. No other-chain execution is exposed.</p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- (e) merchant onboarding */}
      <section className="nx-sec nx-onb" id="merchants">
        <figure className="nx-onb-art" data-reveal><img src="/art/iso-merchant.jpg" alt="A laptop shows a merchant dashboard next to a card terminal printing a receipt" width={900} height={900} loading="lazy" /></figure>
        <div>
          <div className="nx-head" data-reveal>
            <Tag>For merchants</Tag>
            <h2>Start taking test payments <em>in three steps.</em></h2>
          </div>
          <ol className="nx-steps">
            {ONBOARD.map(([t, d], i) => (
              <li key={t} data-reveal style={{ transitionDelay: `${i * 80}ms` }}><span className="mono">0{i + 1}</span><div><b>{t}</b><p>{d}</p></div></li>
            ))}
          </ol>
          <a className="lx-btn dark" href="#/dashboard/onboard">Set up your store</a>
        </div>
      </section>

      {/* ---------------------------------------------------------------- (f) SDK */}
      <section className="nx-dev" id="developers">
        <div className="nx-dev-in">
          <div className="nx-dev-copy" data-reveal>
            <Tag dark>Noren SDK</Tag>
            <h2>Get paid in <em>about ten lines.</em></h2>
            <p>A local merchant REST API and the native NEAR TypeScript SDK. Store metadata is off-chain; completed payments are checked against NEAR FINAL execution. Signed webhook delivery is not integrated.</p>
            <ul className="nx-endpoints mono">
              <li><b>POST</b> /merchants/:id/invoices</li>
              <li><b>GET</b> /invoices/:id</li>
              <li><b>POST</b> /invoices/:id/complete</li>
              <li><b>POST</b> /auth/near</li>
              <li><b>GET</b> /merchants/:id/events</li>
            </ul>
          </div>
          <div className="nx-code" data-reveal>
            <div className="nx-code-tabs" role="tablist" aria-label="SDK examples">
              {(Object.keys(CODE) as (keyof typeof CODE)[]).map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="mono">{k === "link" ? "Create a link" : k === "read" ? "Verify receipt" : "Customer pays"}</button>
              ))}
            </div>
            <div className="nx-code-file mono"><span>{CODE[tab].file}</span><span>TypeScript</span></div>
            <pre className="mono" key={tab} role="tabpanel">{CODE[tab].lines.map(([t, l], i) => <span key={i} className={`ln ${t}`}><i>{i + 1}</i>{l || " "}</span>)}</pre>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- (g) measured */}
      <section className="nx-sec nx-nums" id="numbers">
        <div className="nx-head" data-reveal>
          <Tag>Measured, not promised</Tag>
          <h2>The rules enforced on NEAR. <span>Test assets, explicit limits and receipts you can inspect.</span></h2>
        </div>
        <div className="nx-num-grid" data-reveal>
          {NUMBERS.map((n) => <div key={n.l}><b>{n.v}{n.u && <em>{n.u}</em>}</b><span>{n.l}</span></div>)}
        </div>
        <p className="nx-note mono">The contract and deployment records verify these parameters. Test stocks are not real shares; test tokens have no cash value.</p>
      </section>

      {/* ---------------------------------------------------------------- (h) cta */}
      <section className="nx-cta" data-reveal>
        <img src="/art/icon.jpg" alt="" width={640} height={640} loading="lazy" aria-hidden />
        <h2>Open your shop's <em>curtain.</em></h2>
        <p>Run the NEAR web app and its local merchant service. Deposit TEST stock, pay the shop on credit, and inspect the receipt.</p>
        <pre className="mono">pnpm install{"\n"}pnpm --filter @noren/near-sdk build{"\n"}pnpm --filter @noren/web dev</pre>
        <div className="lx-ctas"><a className="lx-btn light" href="#/dashboard">Open Noren Merchant</a><a className="lx-btn dark" href="#/app">Open the Noren app</a></div>
      </section>
    </div>
  );
}
