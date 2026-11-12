import { useEffect, useState } from 'react';
import { supportedTokens, dryQuote, type Token } from '@noren/near-sdk';
import { tokenUnits } from './credit-calls';
export function BringQuotes({ close }: { close: () => void }) {
  const [coins,setCoins]=useState<Token[]>(),[symbol,setSymbol]=useState('BTC'),[amount,setAmount]=useState('0.001'),[recipient,setRecipient]=useState('intents.near');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[quote,setQuote]=useState<{ amountOutFormatted?: string; amountInFormatted?: string; timeEstimate?: number }>();
  useEffect(()=>{let active=true;supportedTokens().then(t=>active&&setCoins(t)).catch(()=>active&&setError('The live 1Click catalog could not be loaded. Reopen this quote.'));return()=>{active=false}},[]);
  const chain={BTC:'btc',ETH:'eth',SOL:'sol',ZEC:'zec'}[symbol];
  const origin=coins?.find(t=>t.symbol===symbol&&t.blockchain===chain);
  let raw='';try{if(origin)raw=tokenUnits(amount,origin.decimals)}catch{}
  const valid=/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(recipient)&&!recipient.endsWith('.testnet');
  async function getQuote(){if(!origin||!raw||!valid)return;setBusy(true);setError('');setQuote(undefined);try{const result=await dryQuote({originAsset:origin.assetId,destinationAsset:origin.assetId,amount:raw,recipient,recipientType:'INTENTS',refundTo:recipient,refundType:'INTENTS'});const body=result.quote as {quote?:{amountOutFormatted?:string;amountInFormatted?:string;timeEstimate?:number}};if(!body.quote)throw Error('1Click returned no quote.');setQuote(body.quote)}catch(e){setError(e instanceof Error?e.message:'The dry quote did not complete.')}finally{setBusy(false)}}
  return <div className="nk-modal" role="dialog" aria-modal="true" aria-label="Mainnet dry quote" onClick={e=>e.target===e.currentTarget&&close()}><div className="nk-sheet"><div className="nk-sheet-h"><b>Bring coins</b><button className="nk-x" onClick={close} aria-label="Close">×</button></div><div style={{overflowY:'auto'}}>
    <p className="nc-fine">Mainnet dry quote — nothing moves on testnet. This previews an arrival into a NEAR Intents balance; it does not credit testnet collateral.</p>
    <div className="nk-band" role="radiogroup" aria-label="Origin coin">{['BTC','ETH','SOL','ZEC'].map(s=><button type="button" role="radio" aria-checked={symbol===s} key={s} disabled={busy} onClick={()=>{setSymbol(s);setAmount(({BTC:'0.001',ETH:'0.01',SOL:'1',ZEC:'0.01'} as Record<string,string>)[s]);setQuote(undefined);setError('')}}>{s}</button>)}</div>
    <div className="nk-box"><label htmlFor="coin-amount">Amount in {symbol}</label><input id="coin-amount" className="nk-search" value={amount} disabled={busy} inputMode="decimal" onChange={e=>{setAmount(e.target.value);setQuote(undefined)}} /></div>
    <div className="nk-box"><label htmlFor="coin-recipient">Quote recipient · mainnet NEAR account</label><input id="coin-recipient" className="nk-search" value={recipient} disabled={busy} onChange={e=>{setRecipient(e.target.value.trim());setQuote(undefined)}} /></div>
    {coins&&!origin&&<p className="nc-fine">{symbol} is not currently listed for this origin in the live catalog.</p>}
    <button className="nk-cta" disabled={busy||!origin||!raw||!valid} onClick={getQuote}>{busy?'Asking 1Click…':'Get mainnet dry quote'}</button>
    {error&&<p className="nk-err" role="alert">{error}</p>}
    {quote&&<div className="nc-receipt" role="status"><div className="nc-receipt-h"><b>Dry quote · nothing sent</b></div><p>{quote.amountInFormatted} {symbol} → {quote.amountOutFormatted} {symbol} in the quoted Intents balance.</p><p className="nc-fine">Estimate: {quote.timeEstimate??'—'} s. Mainnet funding, withdrawal and collateral-attribution adapters are required before this becomes a real Noren deposit.</p></div>}
  </div></div></div>;
}
