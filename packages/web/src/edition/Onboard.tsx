// ETHGlobal onboarding markup, with NEAR NEP-413 authentication and local merchant records.
import { useEffect, useState } from "react";
import { SERVER, call, usdc, type Config } from "./api";
import { Copy, Icon, Logo, msgOf } from "./ui";
import { QR } from "./kit";
import { useNearWallet } from "../near/wallet";
import { accountValid } from "../near/credit-calls";
import "./onboard.css";
export type Session={session:string;address:string;expiresAt:number;via:'nep413'};
export type StoreView={id:string;name:string;payout:string;merchant:string;publishableKey:string;keys:{id:string;prefix:string;createdAt:number;revokedAt?:number}[];createdAt:number;registerTx?:string};
const SESSION_KEY='noren.near.merchant.session',STORE_KEY='noren.near.merchant.store';
export const readSession=():Session|null=>{try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)??'null');return s?.expiresAt>Date.now()/1000?s:null}catch{return null}};
export const saveSession=(s:Session|null)=>{try{s?localStorage.setItem(SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(SESSION_KEY)}catch{}};
export const readStoreId=()=>{try{return localStorage.getItem(STORE_KEY)}catch{return null}};
export const saveStoreId=(id:string)=>{try{localStorage.setItem(STORE_KEY,id)}catch{}};
export const listStores=(token:string)=>call<StoreView[]>('/stores',{token});
const STEPS = ["Sign in", "Business", "Payouts", "First payment link", "Developers"];

export function Onboard({ cfg, session, onSession, onStore, onDone }: { cfg: Config; session: Session | null; onSession: (s: Session) => void; onStore: (s: StoreView) => void; onDone: () => void }) {
  const [step, setStep] = useState(session ? 1 : 0);
  const [name, setName] = useState("");
  const [payoutMode, setPayoutMode] = useState<"self" | "other">("self");
  const [payout, setPayout] = useState("");
  const [store, setStore] = useState<StoreView | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState("12.50");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const wallet = useNearWallet();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (session && step === 0) setStep(1); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (k: string, f: () => Promise<void>) => { setBusy(k); setErr(null); try { await f(); } catch (e) { setErr(msgOf(e)); } finally { setBusy(null); } };
  const payTo = (payoutMode === "self" ? session?.address : payout) ?? "";

  const snippet = store ? `// server.ts — keep your API secret on the server
const response = await fetch("${location.origin}${SERVER}/merchants/${store.merchant}/invoices", {
  method: "POST",
  headers: {"content-type":"application/json", authorization: "Bearer " + process.env.NOREN_SECRET_KEY},
  body: JSON.stringify({amount:"12500000",description:"Order #1001"})
});
const {invoice} = await response.json();
// Redirect the customer to /#/pay/ + invoice.invoiceId
` : "";
  const signIn = () => run('near', async () => {
    const account = wallet.account || await wallet.connect();
    if (!account) throw Error('Connect a NEAR testnet Meteor wallet first.');
    const challenge = await call<{challengeId:string;message:string;nonce:string;recipient:string}>('/auth/nonce');
    const signed = await wallet.signMessage(challenge.message, challenge.nonce, challenge.recipient);
    const session = await call<Session>('/auth/near',{method:'POST',body:JSON.stringify({...signed,challengeId:challenge.challengeId})});
    saveSession(session); onSession(session); setStep(1);
  });

  return (
    <div className="ob">
      <aside className="ob-side">
        <div className="ob-brand"><Logo size={28} /><b>Noren Merchant</b></div>
        <p>Set up your store in a minute. Customers can pay with test stocks, test USDC or stock-backed credit. Payments are public on NEAR testnet; private checkout is not integrated.</p>
        <ol className="ob-steps">{STEPS.map((t, i) => <li key={t} data-state={i < step ? "done" : i === step ? "now" : "todo"}><i>{i < step ? <Icon.check /> : i + 1}</i><span>{t}</span></li>)}</ol>
        <p className="ob-fine">NEAR testnet only. Test stocks are not real shares; test USDC has no cash value.</p>
      </aside>

      <section className="ob-main" aria-live="polite">
        {step === 0 && (
          <div className="ob-card">
            <span className="ob-k">Sign in</span><h1>Sign in to Noren Merchant</h1>
            <p>Connect Meteor on NEAR testnet and sign a NEP-413 message. The server verifies your wallet signature. This sends no transaction.</p>
            <div className="ob-choices"><button className="ob-choice" disabled={!!busy || !wallet.ready} onClick={signIn}><Icon.shield/><span><b>{busy ? 'Waiting for wallet…' : 'Meteor Wallet'}</b><small>NEAR testnet · sign a message</small></span><Icon.arrow/></button><button className="ob-choice" disabled><Icon.user/><span><b>Email sign-in</b><small>Not integrated on NEAR</small></span><Icon.arrow/></button></div>
            {(err || wallet.error) && <p className="err" role="alert">{err || wallet.error}</p>}
          </div>
        )}

        {step === 1 && (
          <form className="ob-card" onSubmit={(e) => { e.preventDefault(); if (name.trim()) setStep(2); }}>
            <span className="ob-k">Step 1 of 3</span>
            <h1>What's your business called?</h1>
            <p>Customers see this name on your checkout and receipts.</p>
            <label className="ob-field"><span>Business name</span><input autoFocus maxLength={48} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chai Point, Bandra" /></label>
            <p className="ob-who mono">Signed in as {session?.address}</p>
            <button className="ob-cta" disabled={!name.trim()}>Continue <Icon.arrow /></button>
          </form>
        )}

        {step === 2 && (
          <div className="ob-card">
            <span className="ob-k">Step 2 of 3</span>
            <h1>Where should payouts go?</h1>
            <p>Every completed payment sends test USDC directly to one NEAR testnet account. Payments and the payer are public. Store metadata is saved by the local merchant service.</p>
            <div className="ob-choices" role="radiogroup" aria-label="Payout address">
              <button role="radio" aria-checked={payoutMode === "self"} className="ob-choice" onClick={() => setPayoutMode("self")}><Icon.card /><span><b>test USDC on NEAR to my wallet</b><small className="mono">{session?.address}</small></span></button>
              <button role="radio" aria-checked={payoutMode === "other"} className="ob-choice" onClick={() => setPayoutMode("other")}><Icon.link /><span><b>test USDC on NEAR to another address</b><small>A treasury, a multisig or an exchange deposit</small></span></button>
            </div>
            {payoutMode === "other" && <label className="ob-field"><span>Payout account on NEAR</span><input className="mono" value={payout} onChange={(e) => setPayout(e.target.value.trim())} placeholder="my-shop.testnet" /></label>}
            {err && <p className="err" role="alert">{err}</p>}
            <div className="ob-row">
              <button className="ob-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="ob-cta" disabled={!!busy || !(accountValid(payTo) && payTo.endsWith('.testnet'))} onClick={() => run("store", async () => {
                const r = await call<{ store: StoreView; secretKey: string }>("/stores", { method: "POST", token: session!.session, body: JSON.stringify({ name: name.trim(), payout: payTo }) });
                setStore(r.store); setSecret(r.secretKey); saveStoreId(r.store.id); onStore(r.store); setStep(3);
              })}>{busy === "store" ? <><span className="spin" /> Creating store…</> : <>Create store <Icon.arrow /></>}</button>
            </div>
            <p className="ob-fine">Creating the store saves a local service record. Your named NEAR payout account receives the actual on-chain payments.</p>
          </div>
        )}

        {step === 3 && store && (
          <div className="ob-card">
            <span className="ob-k">Step 3 of 3</span>
            <h1>Create your first payment link</h1>
            <p><b>{store.name}</b> is ready in the local NEAR merchant service. Make a link and share it, or print its QR at the counter.</p>
            {!link ? (
              <>
                <div className="ob-row2">
                  <label className="ob-field"><span>Amount (USDC)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></label>
                  <label className="ob-field"><span>Description</span><input value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} placeholder="Masala chai, large" /></label>
                </div>
                {err && <p className="err" role="alert">{err}</p>}
                <button className="ob-cta" disabled={!!busy || !(Number(amount) > 0)} onClick={() => run("link", async () => {
                  const r = await call<{ invoice: { invoiceId: string } }>(`/merchants/${store.merchant}/invoices`, { method: "POST", token: secret!, body: JSON.stringify({ amount: String(Math.round(Number(amount) * 1e6)), expiry: String(Math.floor(Date.now() / 1000) + 7 * 86400), ...(desc.trim() ? { description: desc.trim() } : {}) }) });
                  setLink(`${location.origin}${location.pathname}#/pay/${r.invoice.invoiceId}`);
                })}>{busy === "link" ? <><span className="spin" /> Creating…</> : <>Create link <Icon.arrow /></>}</button>
                <p className="ob-fine">Created with your new secret key, exactly as your server would.</p>
              </>
            ) : (
              <div className="ob-link">
                <div className="ob-qr"><QR text={link} size={168} /></div>
                <div>
                  <b>{usdc(BigInt(Math.round(Number(amount) * 1e6)))} USDC{desc ? ` · ${desc}` : ""}</b>
                  <code className="ob-url">{link}</code>
                  <div className="ob-row"><Copy text={link} label="Copy link" /><a className="ob-ghost" href={link.slice(link.indexOf("#"))} target="_blank" rel="noreferrer">Open checkout <Icon.ext /></a></div>
                </div>
              </div>
            )}
            {link && <button className="ob-cta" onClick={() => setStep(4)}>Continue <Icon.arrow /></button>}
          </div>
        )}

        {step === 4 && store && (
          <div className="ob-card">
            <span className="ob-k">Developers</span>
            <h1>Your API keys</h1>
            <p>The secret key is shown <b>once</b>. Noren keeps only its hash; you can revoke it or make a new one in Developers.</p>
            <dl className="ob-keys">
              <dt>Publishable key</dt><dd><code>{store.publishableKey}</code><Copy text={store.publishableKey} /></dd>
              <dt>Secret key</dt><dd>{secret ? <><code>{secret}</code><Copy text={secret} /></> : <span className="faint">Already shown. Make a new one in Developers.</span>}</dd>
              <dt>Merchant ID</dt><dd><code>{store.merchant}</code><Copy text={store.merchant} /></dd>
            </dl>
            <div className="ob-snip"><header><span>server.ts</span><Copy text={snippet} label="Copy SDK snippet" /></header><pre>{snippet}</pre></div>
            <button className="ob-cta" onClick={() => { setSecret(null); onDone(); }}>Go to your dashboard <Icon.arrow /></button>
          </div>
        )}
      </section>
    </div>
  );
}
