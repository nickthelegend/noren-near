/** Local merchant service. No private wallet key is read or held here. Every paid receipt is verified against FINAL NEAR execution. */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { JsonRpcProvider } from 'near-api-js';
import { verifyMessage } from 'near-api-js/nep413';
import { bySlug, MAX_QTY } from './catalog';

export const RPC = 'https://test.rpc.fastnear.com';
export const CREDIT = 'credit.noren-near-mw9h22el.testnet';
export const USDC = 'usdc.fakes.testnet';
export const DEMO_SHOP = 'shop.noren-near-mw9h22el.testnet';
const provider = new JsonRpcProvider({url:RPC});
export type Invoice = {invoice:{invoiceId:string;merchant:string;amount:string;expiry:string};status:string;description:string;merchantName:string;createdAt:number;paidAt?:number;paymentTx?:string;method?:string;paidAmount:string;payments:{hash:string;amount:string;method:string;payer:string}[];metadata?:Record<string,string>;successUrl?:string;cancelUrl?:string;stock?:Record<string,string>;plan?:{owner:string;ids:number[];hash:string}};
type Store = {id:string;name:string;payout:string;merchant:string;owner:string;publishableKey:string;keys:{id:string;prefix:string;hash:string;createdAt:number;revokedAt?:number}[];createdAt:number;registerTx?:string};
type Session = {hash:string;address:string;expiresAt:number};
type State = {stores:Store[];invoices:Invoice[];sessions:Session[];events:any[];orders:any[];usedTx:string[];shopMerchant?:string};
const now=()=>Math.floor(Date.now()/1000), hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const testAccount=(s:unknown):s is string=>typeof s==='string'&&s.length<=64&&/^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+testnet$/.test(s);
const amount=(s:unknown)=>{if(typeof s!=='string'||!/^\d+$/.test(s)||BigInt(s)<=0n||BigInt(s)>2n**128n-1n)throw Error('Enter a positive amount in token units.');return s;};
const plain=(s:unknown,max:number)=>typeof s==='string'?s.trim().slice(0,max):'';
const safeUrl=(s:unknown)=>{if(!s)return undefined;try{const u=new URL(String(s));if(!['http:','https:'].includes(u.protocol))throw 0;return u.toString()}catch{throw Error('Return URL must use HTTP or HTTPS.')}};
export const publicStore=(s:Store)=>({...s,keys:s.keys.map(({hash:_,...k})=>k)});
const sameHash=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export type Deps={file?:string|null;view?:(contract:string,method:string,args:any)=>Promise<any>;tx?:(tx:string,account:string)=>Promise<any>;verify?:typeof verifyMessage;account?:(id:string)=>Promise<any>};
export function createMerchantService(deps:Deps={}) {
 const file=deps.file===null?null:deps.file??process.env.NOREN_DATA_FILE??resolve(process.cwd(),'.near-data/merchant.json');
 let state:State=file&&existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{stores:[],invoices:[],sessions:[],events:[],orders:[],usedTx:[]};
 const nonces=new Map<string,{message:string;recipient:string;nonce:string;expiresAt:number}>();
 const save=()=>{if(!file)return;mkdirSync(dirname(file),{recursive:true,mode:0o700});writeFileSync(file+'.tmp',JSON.stringify(state),{mode:0o600});renameSync(file+'.tmp',file)};
 const view=deps.view??(async(contract,method,args)=>{const r=await provider.callFunction({contractId:contract,method,args});return r});
 const tx=deps.tx??(async(tx_hash,sender_account_id)=>{const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'merchant-receipt',method:'tx',params:{tx_hash,sender_account_id,wait_until:'FINAL'}}),signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok||j.error)throw Error('NEAR testnet could not confirm this receipt.');return j.result;});
 const verify=deps.verify??verifyMessage;
 const demo:Store={id:'aubelle',merchant:DEMO_SHOP,payout:DEMO_SHOP,owner:DEMO_SHOP,name:'Aubelle',publishableKey:'pk_test_aubelle_public_demo',keys:[],createdAt:1794182400};
 const store=(id:string)=>state.stores.find(s=>s.id===id||s.merchant===id)??(id===DEMO_SHOP||id==='aubelle'?demo:undefined);
 const session=(token:string)=>state.sessions.find(s=>sameHash(s.hash,hash(token))&&s.expiresAt>now());
 const access=(id:string,token:string,ownerOnly=false)=>{const s=store(id);if(!s)throw Error('Store not found.');const who=session(token);if(who?.address===s.owner)return s;if(!ownerOnly&&s.keys.some(k=>!k.revokedAt&&sameHash(k.hash,hash(token))))return s;throw Error('Session required for this store.');};
 const addKey=(s:Store)=>{const secret='sk_test_'+randomBytes(32).toString('hex');const key={id:randomUUID(),prefix:secret.slice(0,16),hash:hash(secret),createdAt:now()};s.keys.push(key);return{secretKey:secret,key:{...key,hash:undefined}}};
 const event=(type:string,data:any)=>{state.events.push({id:randomUUID(),type,created:now(),data});};
 const newInvoice=(s:Store,b:any)=>{const value=amount(b.amount);const expiry=Number(b.expiry??now()+1800);if(!Number.isSafeInteger(expiry)||expiry<=now()||expiry>now()+30*86400)throw Error('Expiry must be within the next 30 days.');const metadata=b.metadata&&typeof b.metadata==='object'?Object.fromEntries(Object.entries(b.metadata).filter(([k,v])=>k.length<=64&&typeof v==='string'&&v.length<=256)):undefined;const row:Invoice={invoice:{invoiceId:'0x'+randomBytes(32).toString('hex'),merchant:s.merchant,amount:value,expiry:String(expiry)},status:'open',description:plain(b.description,120),merchantName:s.name,createdAt:now(),paidAmount:'0',payments:[],metadata,successUrl:safeUrl(b.successUrl),cancelUrl:safeUrl(b.cancelUrl)};state.invoices.push(row);event('invoice_created',{invoiceId:row.invoice.invoiceId,merchant:s.merchant});save();return row};
 function invoice(id:string){const i=state.invoices.find(i=>i.invoice.invoiceId===id);if(!i)throw Error('Payment link not found.');if(Number(i.invoice.expiry)<now()&&BigInt(i.paidAmount)===0n&&!i.plan)i.status='expired';return i;}
 async function reconcile(i:Invoice,b:any){
  if(!testAccount(b.accountId)||typeof b.hash!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(b.hash))throw Error('Check the testnet transaction and account.');
  if(state.usedTx.includes(b.hash)){if(i.payments.some(p=>p.hash===b.hash))return i;throw Error('Transaction already belongs to another payment link.');}
  if(i.status==='paid')throw Error('This payment link is already paid.');
  if(i.status==='expired')throw Error('This payment link has expired.');
  const result:any=await tx(b.hash,b.accountId);
  if(result.final_execution_status!=='FINAL'||result.status?.Failure||result.receipts_outcome?.some((r:any)=>r.outcome?.status?.Failure))throw Error('Payment is not a successful FINAL execution. Check the explorer before retrying.');
  const transaction=result.transaction;
  if(transaction?.signer_id!==b.accountId||transaction.actions?.length!==1)throw Error('Payment signer or actions do not match.');
  const action=transaction.actions[0].FunctionCall;if(!action)throw Error('Expected a NEAR function call.');
  const args=JSON.parse(Buffer.from(action.args,'base64').toString());const s=store(i.invoice.merchant)!;
  let paid=0n,method='',stock:any;
  if(transaction.receiver_id===USDC&&action.method_name==='ft_transfer'){
   if(args.receiver_id!==s.payout||args.memo!==`noren:${i.invoice.invoiceId}`)throw Error('Payment recipient or invoice binding does not match.');paid=BigInt(amount(args.amount));method='usdc';
  }else if(transaction.receiver_id===CREDIT&&action.method_name==='borrow'){
   if(args.recipient!==s.payout||args.invoice_id!==i.invoice.invoiceId||JSON.parse(Buffer.from(result.status.SuccessValue??'','base64').toString()||'null')!==true)throw Error('Credit payment was not completed for this invoice.');paid=BigInt(amount(args.amount));method='credit';
  }else if(transaction.receiver_id===CREDIT&&action.method_name==='pay_installment'){
   if(args.invoice_id!==i.invoice.invoiceId||JSON.parse(Buffer.from(result.status.SuccessValue??'','base64').toString()||'null')!==true)throw Error('Installment was not completed for this invoice.');
   const item=await view(CREDIT,'installment',{id:args.id});if(!item||item[0]!==b.accountId||item[1]!==s.payout||!item[4])throw Error('Installment owner or recipient does not match.');paid=BigInt(item[2]);method='credit';
  }else if(action.method_name==='ft_transfer_call'){
   const m=JSON.parse(args.msg??'{}');const tokens=['wbtc.fakes.testnet',...['ttsla','tnvda','taapl'].map(t=>`${t}.noren-near-mw9h22el.testnet`)];
   if(!tokens.includes(transaction.receiver_id)||args.receiver_id!==CREDIT||m.kind!=='stock_pay'||m.recipient!==s.payout||m.invoice_id!==i.invoice.invoiceId)throw Error('Stock sale was not bound to this merchant invoice.');
   const used=JSON.parse(Buffer.from(result.status.SuccessValue??'','base64').toString()||'null');if(used!==args.amount)throw Error('Stock sale was refunded.');
   // Verify the actual USDC receipt log, rather than trusting a browser-supplied quote.
   const transfers=(result.receipts_outcome??[]).filter((r:any)=>r.outcome?.executor_id===USDC).flatMap((r:any)=>{
    const logs:string[]=r.outcome.logs??[];
    const modern=logs.filter(l=>l.startsWith('EVENT_JSON:')).map(l=>JSON.parse(l.slice(11))).filter((e:any)=>e.standard==='nep141'&&e.event==='ft_transfer').flatMap((e:any)=>e.data??[]);
    if(modern.length)return modern;
    // The deployed public test USDC predates NEP-297. Accept only its exact
    // transfer + memo pair from the trusted USDC executor, never browser text.
    if(!logs.includes(`Memo: noren:${i.invoice.invoiceId}`))return[];
    return logs.flatMap(l=>{const m=/^Transfer ([0-9]+) from ([a-z0-9._-]+) to ([a-z0-9._-]+)$/.exec(l);return m?[{amount:m[1],old_owner_id:m[2],new_owner_id:m[3],memo:`noren:${i.invoice.invoiceId}`}]:[]});
   }).filter((x:any)=>x.old_owner_id===CREDIT&&x.new_owner_id===s.payout&&x.memo===`noren:${i.invoice.invoiceId}`);
   if(transfers.length!==1)throw Error('No matching USDC merchant transfer was found.');paid=BigInt(amount(transfers[0].amount));method='stocks';stock={asset:transaction.receiver_id,assetIn:args.amount,usdcOut:String(paid),route:'NEAR testnet market buyer'};
  }else throw Error('This transaction is not a supported NEAR checkout payment.');
  if(paid<=0n)throw Error('The payment has no value.');
  // Recheck after asynchronous RPC work to prevent simultaneous claims of one hash.
  if(state.usedTx.includes(b.hash)){if(i.payments.some(p=>p.hash===b.hash))return i;throw Error('Transaction already claimed.');}
  state.usedTx.push(b.hash);i.paidAmount=String(BigInt(i.paidAmount)+paid);i.payments.push({hash:b.hash,amount:String(paid),method,payer:b.accountId});i.method=method;i.paymentTx=b.hash;i.stock=stock;i.paidAt=now();i.status=BigInt(i.paidAmount)>=BigInt(i.invoice.amount)?'paid':'partially_paid';event(i.status==='paid'?'payment.succeeded':'payment.partial',{invoiceId:i.invoice.invoiceId,merchant:s.merchant,amount:String(paid),transaction:b.hash,payer:b.accountId});save();return i;
 }
 async function handle(path:string,method:string,b:any,token:string,recipient:string):Promise<any>{
  const parts=path.split('/').filter(Boolean).map(decodeURIComponent);
  if(path==='/shop/config'){const s=state.shopMerchant?store(state.shopMerchant):demo;return{ready:!!s,missing:s?[]:['NOREN_AUBELLE_STORE_ID'],webhookError:null,server:'/api',merchant:s?.merchant,checkoutBase:process.env.NOREN_WEB_ORIGIN??`http://${recipient}`}}
  if(path==='/shop/fx')throw Error('Fiat conversion is not integrated; catalogue prices use test USDC only.');
  if(path==='/shop/connect'&&method==='POST'){const s=access(String(b.merchant),token,true);state.shopMerchant=s.id;save();return{connected:true,merchant:s.merchant}}
  if(path==='/shop/checkout'&&method==='POST'){
   if(!Array.isArray(b.lines)||b.lines.length===0||b.lines.length>30)throw Error('Add a dress to your bag first.');
   const lines=b.lines.map((l:any)=>{const p=bySlug(l.slug);if(!p||!p.sizes.includes(l.size)||p.soldOut?.includes(l.size)||!Number.isSafeInteger(l.qty)||l.qty<1||l.qty>MAX_QTY)throw Error('Check the product, size and quantity in your bag.');return{slug:p.slug,name:p.name,size:l.size,qty:l.qty,price:p.price}});
   const totalCents=lines.reduce((a:number,l:any)=>a+l.price*l.qty,0),id='AUB-'+randomBytes(4).toString('hex').toUpperCase(),base=process.env.NOREN_WEB_ORIGIN??`http://${recipient}`;
   const s=state.shopMerchant?store(state.shopMerchant):demo;if(!s)throw Error('The demo shop needs a connected merchant.');
   const i=newInvoice(s,{amount:String(BigInt(totalCents)*10000n),description:`Aubelle order ${id}: ${lines.map((l:any)=>l.name).join(', ')}`.slice(0,120),metadata:{orderId:id},successUrl:`${base}/shop/#/order/${id}`,cancelUrl:`${base}/shop/#/bag`});
   const checkoutUrl=`${base}/#/pay/${i.invoice.invoiceId}`;state.orders.push({id,lines,totalCents,invoiceId:i.invoice.invoiceId,checkoutUrl,createdAt:now()});save();return{orderId:id,checkoutUrl};
  }
  if(parts[0]==='shop'&&parts[1]==='orders'&&parts[2]){const o=state.orders.find(o=>o.id===parts[2]);if(!o)throw Error('Order not found.');const i=invoice(o.invoiceId);return{...o,status:i.status==='paid'?'paid':i.status==='open'?'awaiting_payment':i.status,method:i.method,paymentTx:i.paymentTx,paidVia:'verified-near-receipt'}}
  if(path==='/config')return{network:'testnet',chainId:'NEAR testnet',rpcUrl:RPC,merchant:DEMO_SHOP,deployment:{usdc:USDC,checkout:CREDIT},privacy:false};
  if(path==='/auth/nonce'&&method==='GET'){const id=randomUUID(),n={message:`Sign in to Noren Merchant on NEAR testnet.\nChallenge: ${id}`,recipient,nonce:randomBytes(32).toString('base64'),expiresAt:now()+300};nonces.set(id,n);for(const[k,v]of nonces)if(v.expiresAt<now())nonces.delete(k);return{challengeId:id,...n}}
  if(path==='/auth/near'&&method==='POST'){
   const challenge=nonces.get(b.challengeId);nonces.delete(b.challengeId);if(!challenge||challenge.expiresAt<now()||challenge.recipient!==recipient||!testAccount(b.accountId))throw Error('Sign-in challenge expired or account is not testnet.');
   try{await verify({signerAccountId:b.accountId,signerPublicKey:b.publicKey,payload:{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')},signature:Buffer.from(b.signature,'base64'),provider})}catch{throw Error('Wallet signature did not verify for this NEAR testnet account.');}
   const secret=randomBytes(32).toString('hex'),s={hash:hash(secret),address:b.accountId,expiresAt:now()+86400};state.sessions=state.sessions.filter(x=>x.expiresAt>now());state.sessions.push(s);save();return{session:secret,address:s.address,expiresAt:s.expiresAt,via:'nep413'};
  }
  if(path==='/auth/logout'){state.sessions=state.sessions.filter(s=>!sameHash(s.hash,hash(token)));save();return{ok:true}}
  if(path==='/stores'&&method==='GET'){const who=session(token);if(!who)throw Error('Session required.');return state.stores.filter(s=>s.owner===who.address).map(publicStore)}
  if(path==='/stores'&&method==='POST'){
   const who=session(token);if(!who)throw Error('Session required.');if(!testAccount(b.payout)||!plain(b.name,48))throw Error('Enter a business name and a NEAR .testnet payout account.');
   await (deps.account??(async(id:string)=>provider.viewAccount({accountId:id})))(b.payout);
   const s:Store={id:randomUUID(),merchant:randomUUID(),owner:who.address,name:plain(b.name,48),payout:b.payout,publishableKey:'pk_test_'+randomBytes(20).toString('hex'),keys:[],createdAt:now()};const k=addKey(s);state.stores.push(s);save();return{store:publicStore(s),secretKey:k.secretKey};
  }
  if(parts[0]==='stores'&&parts[1]){const s=access(parts[1],token,true);if(parts[2]==='keys'&&method==='POST'){const k=addKey(s);save();return{store:publicStore(s),...k}}if(parts[2]==='keys'&&parts[3]&&method==='DELETE'){const k=s.keys.find(k=>k.id===parts[3]);if(!k)throw Error('API key not found.');k.revokedAt=now();save();return{store:publicStore(s),revoked:true}}}
  if(parts[0]==='merchants'&&parts[1]){
   const id=parts[1],s=store(id);if(!s)throw Error('Store not found.');
   if(parts[2]==='profile'){if(method==='POST'){access(id,token);s.name=plain(b.name,48);save()}return{merchant:s.merchant,name:s.name,payout:s.payout}}
   if(parts[2]==='invoices'){if(method==='POST'){access(id,token);return newInvoice(s,b)}access(id,token);return state.invoices.filter(i=>i.invoice.merchant===s.merchant).map(i=>invoice(i.invoice.invoiceId))}
   if(parts[2]==='events'){access(id,token);return state.events.filter(e=>e.data.merchant===s.merchant)}
   if(parts[2]==='webhooks'){access(id,token);if(method==='GET')return[];throw Error('Signed webhook delivery is not built for this local NEAR edition. Poll the invoice endpoint instead.');}
  }
  if(parts[0]==='invoices'&&parts[1]){const i=invoice(parts[1]);if(parts[2]==='complete'&&method==='POST')return reconcile(i,b);if(parts[2]==='schedule'&&method==='POST'){
    if(i.plan)return i;
    if(!testAccount(b.accountId)||typeof b.hash!=='string'||state.usedTx.includes(b.hash)||i.status==='expired')throw Error('Check the schedule transaction.');
    const r:any=await tx(b.hash,b.accountId),t=r.transaction,a=t?.actions?.[0]?.FunctionCall;
    if(r.final_execution_status!=='FINAL'||r.status?.Failure||t?.receiver_id!==CREDIT||t.signer_id!==b.accountId||t.actions.length!==1||a?.method_name!=='schedule_pay_in_3')throw Error('Schedule has not finalized.');
    const args=JSON.parse(Buffer.from(a.args,'base64').toString()),ids=JSON.parse(Buffer.from(r.status.SuccessValue??'','base64').toString()||'null');
    if(args.invoice_id!==i.invoice.invoiceId||args.recipient!==store(i.invoice.merchant)!.payout||args.total!==String(BigInt(i.invoice.amount)-BigInt(i.paidAmount))||!Array.isArray(ids)||ids.length!==3||!ids.every(Number.isSafeInteger))throw Error('Schedule does not match this invoice.');
    if(state.usedTx.includes(b.hash))throw Error('Schedule already claimed.');state.usedTx.push(b.hash);i.plan={owner:b.accountId,ids,hash:b.hash};save();return i;
   }if(parts[2])throw Error('This feature is not available on NEAR testnet.');return i}
  if(path==='/pricing/currencies')return[{code:'USDC',name:'test USDC',symbol:'$',decimals:6}];
  throw Error('Route not found or unavailable on NEAR testnet.');
 }
 async function middleware(req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url??'/','http://localhost');if(!url.pathname.startsWith('/api/'))return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  const origin=req.headers.origin, host=req.headers.host??'localhost';
  const allowed=process.env.NOREN_WEB_ORIGIN;
  let recipient=host;
  if(origin){
   let u:URL;try{u=new URL(origin)}catch{res.statusCode=403;res.end(JSON.stringify({error:'Invalid origin.'}));return true}
   if(u.host!==host&&origin!==allowed){res.statusCode=403;res.end(JSON.stringify({error:'Cross-origin requests require the exact NOREN_WEB_ORIGIN.'}));return true}
   recipient=u.host;
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','content-type, authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
  }
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return true}
  try{let data='';for await(const part of req){data+=part;if(data.length>32768)throw Error('Request too large.')}const b=data?JSON.parse(data):{};const token=(req.headers.authorization??'').replace(/^Bearer /,'');const path=url.pathname.slice(4);const result=await handle(path,req.method??'GET',b,token,recipient);res.end(JSON.stringify(result))}
  catch(e){const msg=e instanceof Error?e.message:'Request failed.';res.statusCode=/not found|Route not found/i.test(msg)?404:/Session required/.test(msg)?401:400;res.end(JSON.stringify({error:/^[A-Za-z][^\n]{0,200}$/.test(msg)?msg:'The NEAR service could not confirm this request. Check your transaction before retrying.'}))}
  return true;
 }
 return{handle,middleware};
}
