/** NEAR-only merchant API adapter. The default is the same-origin local service. */
export const SERVER=(import.meta.env.VITE_NOREN_API as string|undefined)?.replace(/\/+$/,'')||'/api';
export type Config={network:'testnet';chainId:string;rpcUrl:string;merchant:string;deployment:{usdc:string;checkout:string;[k:string]:any};[k:string]:any};
export type InvoiceView={invoice:{invoiceId:string;merchant:string;amount:string;expiry:string;receiptCommitment?:string;[k:string]:any};status:string;description?:string;merchantName?:string;method?:'private'|'credit'|'stocks'|'usdc';stock?:any;creditLineId?:string;rateCheck?:any;[k:string]:any};
export type Webhook={id:string;url:string;createdAt?:number|string;secret?:string};
export type Delivery={endpointId:string;url:string;attempt:number;status:number|null;ok:boolean;ms?:number;error?:string;at?:number|string};
export type NorenEvent={id:string;type:string;created:number|string;data:Record<string,any>;deliveries?:Delivery[]};
export const sessionToken=()=>{try{return JSON.parse(localStorage.getItem('noren.near.merchant.session')??'null')?.session??''}catch{return''}};
export async function call<T=any>(path:string,init:RequestInit&{token?:string}={}):Promise<T>{
 let r:Response;try{r=await fetch(SERVER+path,{...init,headers:{'content-type':'application/json',...(init.token?{authorization:`Bearer ${init.token}`}:{})}})}catch{throw Error('The NEAR merchant service is unavailable. Start the local web server or configure VITE_NOREN_API.')}const j=await r.json().catch(()=>null);if(!j)throw Error('The NEAR merchant API is not configured. Use the local web server or set VITE_NOREN_API before a hosted build.');if(!r.ok)throw Error(j?.error??`Merchant request failed (${r.status}).`);return j;
}
const post=(path:string,body:any,token?:string)=>call(path,{method:'POST',token,body:JSON.stringify(body)});
export const api={
 connectShop:(merchant:string,token:string)=>post('/shop/connect',{merchant},token),
 config:()=>call<Config>('/config'),
 listInvoices:(merchant:string,token=sessionToken())=>call<InvoiceView[]>(`/merchants/${merchant}/invoices`,{token}),
 invoice:(id:string)=>call<InvoiceView>(`/invoices/${id}`),
 profile:(merchant:string)=>call<{name:string|null;payout:string}>(`/merchants/${merchant}/profile`),
 setProfile:(merchant:string,name:string,token:string)=>post(`/merchants/${merchant}/profile`,{name},token),
 createInvoice:(merchant:string,amount:bigint,expiry:bigint,token:string,description?:string)=>post(`/merchants/${merchant}/invoices`,{amount:String(amount),expiry:String(expiry),description},token),
 refund:(id:string,amount:bigint,token:string)=>post(`/invoices/${id}/refund`,{amount:String(amount)},token),
 webhooks:(merchant:string,token:string)=>call<Webhook[]>(`/merchants/${merchant}/webhooks`,{token}),
 addWebhook:(merchant:string,url:string,token:string)=>post(`/merchants/${merchant}/webhooks`,{url},token),
 deleteWebhook:(merchant:string,id:string,token:string)=>call(`/merchants/${merchant}/webhooks/${id}`,{method:'DELETE',token}),
 eventLog:(merchant:string,token:string)=>call<NorenEvent[]>(`/merchants/${merchant}/events`,{token}),
 events:()=>{const e=new EventTarget();const timer=setInterval(()=>e.dispatchEvent(new Event('message')),4000);return{addEventListener:(...args:Parameters<EventTarget['addEventListener']>)=>e.addEventListener(...args),close:()=>clearInterval(timer)}}
};
export const assetSym=(asset?:string)=>asset?.startsWith('ttsla.')?'TSLA':asset?.startsWith('tnvda.')?'NVDA':asset?.startsWith('taapl.')?'AAPL':undefined;
export const usdc=(base?:string|bigint)=>base===undefined?'–':(Number(BigInt(base))/1e6).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export const short=(s?:string,n=6)=>s?`${s.slice(0,n)}…${s.slice(-4)}`:'';
export const secs=(v?:string|number)=>v===undefined||v===null||v===''?undefined:Number(v);
export const when=(v?:string|number)=>{const n=secs(v);return n?new Date(n*1000).toLocaleString():'–'};
