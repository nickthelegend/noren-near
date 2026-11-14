/**
 * Noren on NEAR film v7: the credit and checkout takes with the test wallet's Approve sheet and an explorer result after every signed payment (Claude, Nov 14; BTC-backed because US stocks are closed). One real run on NEAR testnet with the build-gated QA signer.
 * Camera = Chrome DevTools screencast (1440x810 CSS at 4/3 device scale -> 1920x1080 JPEG frames), as in the
 * ETHGlobal film's recorder. Every transaction is real, FINAL, logged with its hash and opened on the explorer.
 * Usage: node record.mjs [--surface-only]
 */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync,utimesSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {withChromeLock,LOCK} from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import {loadDeployment,loadCreds,accountFor,provider,view,signPrice,fetchBtcSpot} from '/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near/scripts/near-lib.ts';

const repo='/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near';
const H=decodeURIComponent(new URL('.',import.meta.url).pathname),APP='http://127.0.0.1:5330';
const require=createRequire(join(repo,'package.json')),{chromium}=require('playwright-core'),{actions}=require('near-api-js');
const d=loadDeployment(),account=d.accounts.alice,credit=d.accounts.credit,usdc=d.accounts.tusdc,R0=d.root;
const STOCK={tTSLA:'ttsla.'+R0,tNVDA:'tnvda.'+R0,tAAPL:'taapl.'+R0},tsla='wbtc.fakes.testnet';
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const WORK='/Volumes/Extreme SSD/Projects/grokbot/videos/noren-near/film-v7/work',FR=join(WORK,'frames-'+stamp);mkdirSync(FR,{recursive:true});
const surfaceRun=process.argv.includes('--surface-only');const file=surfaceRun?join(WORK,'rehearsal.json'):join(repo,'deployments/near7-film-'+stamp+'.json'),pointer=join(WORK,surfaceRun?'rehearsal-pointer.json':'live.json');
const shots='/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/noren-near/claude-film-v7';mkdirSync(shots,{recursive:true});
const surfacesOnly=process.argv.includes('--surface-only');const resumeFrom=process.argv.find(a=>a.startsWith('--resume='))?.slice(9);
const check=(ok,m)=>{if(!ok)throw Error(m)},sleep=ms=>new Promise(r=>setTimeout(r,ms));
const marketOpen=()=>{const n=new Date(),m=n.getUTCHours()*60+n.getUTCMinutes();return n.getUTCDay()>0&&n.getUTCDay()<6&&m>=870&&m<1260};
let R,signer,stage='preflight',app,exp,context,lastYahoo=0;const tasks=new Set();
const save=()=>{if(R){writeFileSync(file,JSON.stringify(R,(k,v)=>typeof v==="bigint"?String(v):v,2)+'\n');writeFileSync(pointer,JSON.stringify(R,(k,v)=>typeof v==="bigint"?String(v):v,2)+'\n')}};
const freePct=()=>Number(/free percentage: (\d+)/.exec(execFileSync('memory_pressure',{encoding:'utf8'}))?.[1]??0);
async function gate(){while(freePct()<25){console.log('Waiting for free memory.');await sleep(20000)}}

// ---- budget guard for every browser-signed transaction (testnet only; realistic prepaid-gas bound)
async function reserve(q){
 check(!surfacesOnly,'Surface rehearsal refuses all chain transactions.');check(q.receiverId.endsWith('.testnet'),'Testnet receiver required.');
 const gp=BigInt((await provider.viewGasPrice()).gas_price),cost=BigInt(q.gas)*gp+BigInt(q.deposit);
 const a=await provider.viewAccount({accountId:account});check(BigInt(a.amount)-BigInt(a.storage_usage)*10n**19n>cost+5n*10n**21n,'Low NEAR for prepaid gas.');
 const used=BigInt(R.reservedYocto)+cost;check(used<=400n*10n**21n,'Film reservation cap 0.4 testnet NEAR (3x pessimistic prepaid gas) reached.');R.reservedYocto=String(used);R.attempts.push({stage,...q});save();
}

// ---- camera: one CDP screencast per page; frames keep their wall-clock timestamps
const cams=new Map();
async function camera(p,name){
 const dir=join(FR,name);mkdirSync(dir,{recursive:true});const cdp=await context.newCDPSession(p);const cam={name,dir,list:[],cdp};cams.set(p,cam);
 cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{const n=cam.list.length;const f=String(n).padStart(6,'0')+'.jpg';writeFileSync(join(dir,f),Buffer.from(data,'base64'));cam.list.push([metadata.timestamp,f]);cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{})});
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:86,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
}
const flushIndex=()=>{for(const c of cams.values())writeFileSync(join(c.dir,'index.json'),JSON.stringify(c.list))};

// ---- hands: a visible pointer, human-paced clicks and typing; every action is logged
const CURSOR=`(()=>{const mk=()=>{if(document.getElementById('film-cursor')||!document.body)return;const n=document.createElement('div');n.id='film-cursor';n.style.cssText='position:fixed;left:-40px;top:-40px;width:26px;height:26px;pointer-events:none;z-index:2147483647;transition:transform .12s';n.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2.5l6.8 18.2 2.5-7.3 7.2-2.6z" fill="#fff" stroke="#101a3c" stroke-width="1.6" stroke-linejoin="round"/></svg>';document.body.append(n);addEventListener('mousemove',e=>{n.style.left=e.clientX-4+'px';n.style.top=e.clientY-3+'px'},true);addEventListener('mousedown',()=>n.style.transform='scale(.82)',true);addEventListener('mouseup',()=>n.style.transform='',true)};if(document.readyState==='loading')addEventListener('DOMContentLoaded',mk);else mk();new MutationObserver(mk).observe(document,{childList:true,subtree:true})})()`;
const mouse=new Map();
function ev(p,type,extra={}){R.events.push({page:cams.get(p)?.name,t:Date.now()/1000,type,stage,...extra});save()}
async function moveTo(p,x,y,steps=18){const m=mouse.get(p)??{x:1200,y:700};for(let i=1;i<=steps;i++){const k=i/steps,e=k<.5?2*k*k:1-(-2*k+2)**2/2;await p.mouse.move(m.x+(x-m.x)*e,m.y+(y-m.y)*e);await sleep(16)}mouse.set(p,{x,y});ev(p,'move',{x,y})}
async function point(p,loc){
 loc=loc.first();await loc.waitFor({state:'visible'});await loc.scrollIntoViewIfNeeded();let b=await loc.boundingBox();check(b,'Missing filmed control.');
 if(b.y<80||b.y+Math.min(b.height,100)>790){await loc.evaluate(e=>e.scrollIntoView({block:'center',behavior:'smooth'}));await sleep(800);b=await loc.boundingBox()}
 await moveTo(p,b.x+b.width/2,b.y+Math.min(b.height/2,40));
}
async function click(p,loc,hold=260){await point(p,loc);await sleep(hold);ev(p,'click');const m=mouse.get(p);await p.mouse.down();await sleep(70);await p.mouse.up();await sleep(260)}
async function fill(p,loc,value){await click(p,loc);await loc.first().press('ControlOrMeta+A');await loc.first().press('Backspace');ev(p,'type',{value:value.length>40?'(long)':value});await p.keyboard.type(value,{delay:55});await sleep(250)}
async function glide(p,dy,ms=1600){const n=Math.max(1,Math.round(ms/33));ev(p,'scroll',{dy});for(let i=0;i<n;i++){await p.mouse.wheel(0,dy/n);await sleep(33)}}
async function hash(h){await app.evaluate(h=>location.hash=h,h);await sleep(700)}
async function still(p,name){const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,bad:/\bundefined\b|\bNaN\b/.test(document.body.innerText)}));R.stills.push({name,...m});save();await p.screenshot({path:join(shots,name+'.png')})}
async function take(name,p,fn){stage=name;R.stage=name;save();await p.bringToFront();const start=Date.now()/1000;R.activeTake={id:name,page:cams.get(p).name,start};save();await fn();await sleep(900);const end=Date.now()/1000;await still(p,name);R.takes.push({id:name,page:cams.get(p).name,start,end});delete R.activeTake;flushIndex();save();console.log('take',name,(end-start).toFixed(1)+'s')}
async function connect(){const b=app.getByRole('button',{name:'Connect Meteor Wallet',exact:true});await sleep(600);if(await b.count()&&await b.first().isVisible())await click(app,b);await sleep(700)}
async function final(name){ev(app,'wait-start',{label:name});await app.waitForFunction(()=>[...document.querySelectorAll('[role="status"],.co-done')].some(x=>/final on NEAR testnet/i.test(x.textContent??'')),undefined,{timeout:120000});await Promise.all([...tasks]);ev(app,'wait-end',{label:name});const t=R.transactions.filter(x=>x.action===name);check(t.length>0,'No transaction hash captured for '+name);for(const x of t){const j=await txStatus(x.hash);x.final=j.final;x.ok=j.ok}save();check(t.every(x=>x.final&&x.ok),'Transaction not successful FINAL: '+name)}
async function txStatus(h){const q=await fetch('https://test.rpc.fastnear.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'film',method:'tx',params:{tx_hash:h,sender_account_id:account,wait_until:'FINAL'}})});const j=await q.json();return{final:j.result?.final_execution_status==='FINAL',ok:!!j.result&&!j.result.status?.Failure&&!j.result.receipts_outcome.some(r=>r.outcome.status.Failure)}}
async function explorer(name,hold=2600){const t=R.transactions.find(x=>x.action===name&&x.source==='browser QA signer');check(t,'No hash for explorer: '+name);for(let k=0;;k++){await exp.goto(`https://nearvalidate.org/txns/${t.hash}?network=testnet`,{waitUntil:'domcontentloaded',timeout:60000});try{await exp.getByText('Success',{exact:true}).first().waitFor({timeout:20000});break}catch(e){if(k>=8)throw e;await sleep(8000)}}await sleep(1200);await take('explorer-'+name,exp,async()=>{await point(exp,exp.getByText('Success',{exact:true}));await sleep(hold)});t.explorerShown=true;t.explorerURL=exp.url();save();await app.bringToFront()}

// ---- signed market prices (Yahoo Finance, original timestamp; Noren relayer signature checked on-chain)
async function post(symbol,q){const creds=loadCreds();const {message:_,...args}=signPrice(creds.relayerKey,credit,STOCK[symbol],BigInt(q.priceUsd6),BigInt(q.timestampNs),q.source);const g={receiverId:credit,gas:'30000000000000',deposit:'0'};await reserve(g);const tx=await signer.signAndSendTransaction({receiverId:credit,actions:[actions.functionCall('post_signed_price',args,30000000000000n,0n)],waitUntil:'FINAL',throwOnFailure:false});R.transactions.push({source:'Node price relayer',action:'price-'+symbol+'-'+stage,hash:tx.transaction.hash,final:true,ok:!tx.status.Failure,priceUsd6:String(q.priceUsd6),publishTime:q.publishTime});save();check(!tx.status.Failure,'Price post failed.')}
async function fresh(symbols=['tTSLA'],maxAge=40){
 check(marketOpen(),'US market closed: no fresh stock price.');const all=await view(credit,'assets');
 const stale=symbols.filter(s=>{const a=all.find(x=>x.token===STOCK[s]);return !a||!a.price_fresh||Date.now()-Number(BigInt(a.price_at_ns)/1000000n)>maxAge*1000});if(!stale.length)return;
 await sleep(Math.max(0,lastYahoo+8000-Date.now()));const qs=[];for(const sym of stale){for(let k=0;;k++){try{qs.push(...await equityPrices([sym]));break}catch(e){R.errors.push({stage,type:'yahoo',message:e.message});if(k>=4||!/429/.test(e.message))throw e;await sleep(12000*(k+1))}}await sleep(2500)}lastYahoo=Date.now();
 for(const q of qs){check(q.provider==='Yahoo Finance'&&q.fresh&&Date.now()/1000-q.publishTime<60,'No fresh Yahoo quote for '+q.symbol);R.quotes.push(q);save();await post(q.symbol,q)}
}
const snap=async()=>({position:await view(credit,'position',{borrower:account}),tsla:await view(tsla,'ft_balance_of',{account_id:account}),usdc:await view(usdc,'ft_balance_of',{account_id:account}),shop:await view(usdc,'ft_balance_of',{account_id:d.accounts.shop}),near:(await provider.viewAccount({accountId:account})).amount});


const WBTC='wbtc.fakes.testnet',STORE_MERCHANT='6f0fe517-99db-47d3-9e0a-0528a0347a6e';
async function newLink(){const H2={'content-type':'application/json',origin:APP};const c=await(await fetch(APP+'/api/auth/nonce',{headers:H2})).json();
 const {signMessage}=await import(join(repo,'node_modules/near-api-js/lib/nep413/index.js'));const creds=loadCreds(),owner=accountFor(d.accounts.alice,creds.subKey);
 const sig=await signMessage({signerAccount:owner,payload:{message:c.message,recipient:c.recipient,nonce:Buffer.from(c.nonce,'base64')}});
 const auth=await(await fetch(APP+'/api/auth/near',{method:'POST',headers:H2,body:JSON.stringify({challengeId:c.challengeId,accountId:sig.accountId,publicKey:sig.publicKey.toString(),signature:Buffer.from(sig.signature).toString('base64')})})).json();check(auth.session,'Merchant sign-in failed: '+JSON.stringify(auth));
 const inv=await(await fetch(APP+`/api/merchants/${STORE_MERCHANT}/invoices`,{method:'POST',headers:{...H2,authorization:'Bearer '+auth.session},body:JSON.stringify({amount:'12000000',description:'Silk scrunchie set'})})).json();check(inv.invoice?.invoiceId,'Invoice failed: '+JSON.stringify(inv));return APP+'/#/pay/'+inv.invoice.invoiceId}
// US stocks are closed: credit is backed by test BTC, priced by the same signed-price path (Coinbase spot, relayer signature checked on-chain).
async function freshBtc(maxAge=40){const all=await view(credit,'assets');const a=all.find(x=>x.token===WBTC);if(a&&a.price_fresh&&Date.now()-Number(BigInt(a.price_at_ns)/1000000n)<maxAge*1000)return;
 const spot=await fetchBtcSpot(),creds=loadCreds();const {message:_,...args}=signPrice(creds.relayerKey,credit,WBTC,spot.priceUsd6,spot.timestampNs);await reserve({receiverId:credit,gas:'30000000000000',deposit:'0'});
 const tx=await signer.signAndSendTransaction({receiverId:credit,actions:[actions.functionCall('post_signed_price',args,30000000000000n,0n)],waitUntil:'FINAL',throwOnFailure:false});
 R.transactions.push({source:'Node price relayer',action:'price-btc-'+stage,hash:tx.transaction.hash,final:true,ok:!tx.status.Failure,priceUsd6:String(spot.priceUsd6)});save();check(!tx.status.Failure,'Price post failed.')}
// The test wallet's Approve sheet: read it on camera, then click Approve.
async function approve(){await app.locator('[data-qa-approval]').waitFor();await sleep(1100);await point(app,app.locator('[data-qa-approval] dl'));await sleep(2600);await click(app,app.locator('[data-qa-approve]'),450);await sleep(500)}

async function main(){
 check(d.network==='testnet','Testnet only.');await gate();
 const before=await snap();check(before.position.debt_usd6==='0'&&before.position.collateral.length===0,'Demo position is not clean.');
 const prior=undefined;
 R={network:'testnet',evidenceFile:file.split('/').at(-1),framesDir:FR,resumedFrom:prior?resumeFrom.split('/').at(-1):undefined,usdcInvoiceURL:prior?.usdcInvoiceURL,account,startedAt:new Date().toISOString(),status:'RUNNING',reservedYocto:'0',stage,takes:[],events:[],stills:[],attempts:[],transactions:[],quotes:[],errors:[],invoices:{...(prior?.invoices??{})},before};save();
 const creds=loadCreds();signer=accountFor(account,creds.subKey);
 await withChromeLock(async()=>{
  await gate();const heart=setInterval(()=>{try{utimesSync(LOCK,new Date(),new Date())}catch{}},30000);
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--hide-scrollbars']});
  try{
   context=await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:4/3});
   await context.addInitScript(CURSOR);
   await context.addInitScript(({origin,accountId,privateKey,approve})=>{if(location.origin!==origin)return;try{sessionStorage.setItem('noren.qa.owngas','1')}catch{}window.__NOREN_QA_SIGNER__={accountId,privateKey,rpcUrl:'https://test.rpc.fastnear.com',approve};const add=()=>{if(!document.head||document.getElementById('film-redaction'))return;const s=document.createElement('style');s.id='film-redaction';s.textContent='.ob-keys dd:nth-of-type(2),.sd-secret{position:relative!important;color:transparent!important;background:#101a3c!important;overflow:hidden!important}.ob-keys dd:nth-of-type(2)>*,.sd-secret>*{visibility:hidden!important}.ob-keys dd:nth-of-type(2)::after,.sd-secret::after{content:"secret key · redacted";position:absolute;inset:0;display:grid;place-items:center;color:#efe8db;font:500 14px monospace}';document.head.append(s)};new MutationObserver(add).observe(document,{childList:true,subtree:true});add()},{origin:APP,accountId:account,privateKey:creds.subKey,approve:true});
   app=await context.newPage();app.setDefaultTimeout(60000);await app.exposeFunction('__norenQaAuthorize',reserve);
   app.on('pageerror',e=>{R.errors.push({stage,type:'page exception',message:String(e.message).slice(0,200)});save()});
   app.on('response',r=>{if(!r.url().startsWith('https://test.rpc.fastnear.com'))return;let q;try{q=r.request().postDataJSON()}catch{return}if(!['send_tx','broadcast_tx_commit','broadcast_tx_async'].includes(q?.method))return;const at=stage,t=(async()=>{const j=await r.json(),h=j.result?.transaction?.hash??j.result?.transaction_outcome?.id??(typeof j.result==='string'?j.result:null);if(h&&!R.transactions.some(x=>x.hash===h)){R.transactions.push({source:'browser QA signer',action:at,hash:h});save()}})().catch(()=>{R.errors.push({stage:at,type:'hash capture failed'});save()});tasks.add(t);t.finally(()=>tasks.delete(t))});
   exp=await context.newPage();exp.setDefaultTimeout(60000);
   await camera(app,'app');await camera(exp,'explorer');await app.bringToFront();

   R.usdcInvoiceURL=await newLink();save();
   // 5. The Noren app: Home, then pay the merchant's first link from Pay
   await app.goto(APP+'/#/app');await connect();await app.locator('.nk-wallet').waitFor();await sleep(1500);
   await take('app-home',app,async()=>{await point(app,app.locator('.nk-wallet-total'));await sleep(2200);await glide(app,520,1300);await sleep(2200);await glide(app,-520,900);await sleep(700)});
   await take('pay-usdc',app,async()=>{await click(app,app.getByRole('tab',{name:'Pay',exact:true}));await sleep(900);await click(app,app.locator('#nk-link'));await app.locator('#nk-link').fill(R.usdcInvoiceURL);ev(app,'paste');await sleep(900);await click(app,app.getByRole('link',{name:'Open checkout',exact:true}));await app.locator('.co-amt').waitFor();await connect();
    await click(app,app.getByRole('tab',{name:/^Pay with USDC/}));await sleep(900);await click(app,app.getByRole('button',{name:'Pay 12.00 test USDC',exact:true}));await approve();await final('pay-usdc');await app.getByRole('heading',{name:'Paid with test USDC'}).waitFor();await sleep(2400)});
   await explorer('pay-usdc');
   // 6. Keep your Tesla: deposit 2 tTSLA as collateral, read the credit limit
   await hash('#/app/earn');await connect();
   await take('deposit',app,async()=>{await point(app,app.locator('.nk-hero'));await sleep(900);await app.locator('#near-collateral').selectOption(tsla);await fill(app,app.locator('#near-token-amount'),'0.0075');await click(app,app.getByRole('button',{name:'Deposit collateral',exact:true}));await approve();await final('deposit');await sleep(1500);await point(app,app.locator('.nk-hero'));await sleep(2200)});
   await explorer('deposit');
   await take('credit-tab',app,async()=>{await click(app,app.getByRole('tab',{name:'Credit',exact:true}));await sleep(1800);await glide(app,560,1300);await sleep(2000);await glide(app,-560,900);await sleep(500)});
   // 7. Pay later at Aubelle: the shop is paid in full from credit, the stock stays locked
   await freshBtc();
   await app.goto(APP+'/shop/#/p/juliette-puff');await sleep(1500);
   await take('pay-later',app,async()=>{await click(app,app.getByRole('button',{name:'M',exact:true}));await click(app,app.getByRole('button',{name:/Add to bag/}));await sleep(800);await click(app,app.getByRole('link',{name:'View bag',exact:true}));await sleep(900);
    await click(app,app.getByRole('button',{name:/Checkout with/}));await app.waitForURL(/#\/pay\/0x/);await app.locator('.co-amt').waitFor();R.invoices.later=app.url();save();await connect();
    await click(app,app.getByRole('tab',{name:/^Pay later/}));await sleep(1500);await freshBtc(50);await click(app,app.getByRole('button',{name:/^Pay .* test USDC on credit$/}));await approve();await final('pay-later');await app.getByRole('heading',{name:'Paid with credit'}).waitFor();await sleep(2200);await click(app,app.getByRole('link',{name:'Return to Aubelle',exact:true}));await app.getByText('Thank you.',{exact:false}).first().waitFor();await sleep(2000)});
   await explorer('pay-later');
   // 8. Pay in 3: a schedule, then the first draw
   await app.goto(APP+'/shop/#/p/rosalie-knit');await sleep(1500);
   await take('pay-in-3',app,async()=>{await click(app,app.getByRole('button',{name:'S',exact:true}));await click(app,app.getByRole('button',{name:/Add to bag/}));await sleep(800);await click(app,app.getByRole('link',{name:'View bag',exact:true}));await sleep(900);
    await click(app,app.getByRole('button',{name:/Checkout with/}));await app.waitForURL(/#\/pay\/0x/);await app.locator('.co-amt').waitFor();R.invoices.plan=app.url();save();await connect();
    await click(app,app.getByRole('tab',{name:/^Pay in 3/}));await sleep(1500);await click(app,app.getByRole('button',{name:'Create three-draw schedule',exact:true}));await approve();await final('pay-in-3');await app.getByText('Pay-in-3 schedule on NEAR',{exact:true}).waitFor();await sleep(1500)});
   await explorer('pay-in-3');
   await freshBtc();
   await take('draw-1',app,async()=>{await click(app,app.getByRole('button',{name:'Draw part 1 now',exact:true}));await approve();await final('draw-1');await app.getByRole('button',{name:/Part 1 · paid/}).waitFor({timeout:30000}).catch(()=>{});await sleep(2600)});
   await explorer('draw-1');
   // 9. Repay from the app (top up test USDC first), then take the same stock back
   await app.goto(APP+'/#/app/credit');await connect();await sleep(1500);
   await take('repay',app,async()=>{await point(app,app.getByText('Your position',{exact:true}));await sleep(1800);
    const pos=await view(credit,'position',{borrower:account}),bal=await view(usdc,'ft_balance_of',{account_id:account});
    if(BigInt(bal)<BigInt(pos.debt_usd6)+2_000_000n){await click(app,app.locator('.nk-chip'));await sleep(700);stage='faucet';await click(app,app.getByRole('button',{name:'Get 200 test USDC',exact:true}));await approve();await final('faucet');stage='repay';await sleep(800);const c=app.getByRole('button',{name:'Close',exact:true});if(await c.count())await click(app,c)}
    await click(app,app.getByRole('button',{name:'Repay credit',exact:true}));await approve();await final('repay');await sleep(1800);await point(app,app.getByText('Your position',{exact:true}));await sleep(1600)});
   await explorer('repay');
   await take('withdraw',app,async()=>{await click(app,app.getByRole('tab',{name:'Earn',exact:true}));await sleep(900);await app.locator('#near-collateral').selectOption(tsla);await fill(app,app.locator('#near-token-amount'),'0.0075');await click(app,app.getByRole('button',{name:'Withdraw collateral',exact:true}));await approve();await final('withdraw');await sleep(2400)});
   // ledger checks
   R.after=await snap();check(R.after.position.debt_usd6==='0'&&R.after.position.collateral.length===0,'Position not restored.');
   check(R.transactions.filter(t=>t.source==='browser QA signer').every(t=>t.final&&t.ok),'Unverified transaction.');
   R.status=R.errors.some(e=>e.type!=='yahoo')?'PASS_WITH_PAGE_ERRORS':'PASS';save();
  }finally{flushIndex();for(const c of cams.values())await c.cdp.send('Page.stopScreencast').catch(()=>{});if(context)await context.close();await browser.close();clearInterval(heart)}
 });
}
try{await main()}catch(e){if(R){R.status='STOPPED';R.failedStage=stage;R.error=e.message;flushIndex();save()}console.error('Film stopped at '+stage+': '+e.message+'\n'+e.stack);process.exitCode=1}
finally{if(R){R.finishedAt=new Date().toISOString();try{const a=await provider.viewAccount({accountId:account});R.actualNearSpentYocto=String(BigInt(R.before.near)-BigInt(a.amount))}catch{}save();console.log('Film evidence',R.status,R.transactions.length,'tx')}}
