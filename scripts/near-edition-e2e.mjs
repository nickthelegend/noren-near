/** Real merchant authentication and NEAR-edition browser regression. No trace/HAR/key copies. */
import {readFileSync,writeFileSync,mkdirSync,utimesSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {actions} from 'near-api-js';
import {loadDeployment,view,provider,fetchBtcSpot,signPrice,accountFor} from './near-lib.ts';
const root=resolve(import.meta.dirname,'..'),base=process.env.NOREN_QA_ORIGIN??'http://127.0.0.1:5395';
if(!/^http:\/\/(127\.0\.0\.1|localhost):5[3-9]\d\d$/.test(base))throw Error('Loopback QA origin on ports 5300–5999 required.');
const {withChromeLock,LOCK}=await import(resolve(root,'../../orchestration/chrome-lock.mjs'));
const dir=resolve(root,'../../orchestration/shots/noren-near/ethglobal-port'),d=loadDeployment(),account=d.accounts.alice;
const cryptoMode=process.argv.includes('--live-crypto'),live=process.argv.includes('--live-usdc')||cryptoMode,prefix=process.env.QA_PREFIX??'edition';
const file=join(root,`deployments/ethglobal-browser-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
const report={network:'testnet',startedAt:new Date().toISOString(),account,liveUsdc:live&&!cryptoMode,liveCrypto:cryptoMode,status:'RUNNING',screenshots:[],transactions:[],checks:[],attempts:[]};
const save=()=>writeFileSync(file,JSON.stringify(report,null,2)+'\n');const check=(ok,m)=>{if(!ok)throw Error(m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
while(Number(/free percentage: (\d+)/.exec(execFileSync('memory_pressure',{encoding:'utf8'}))?.[1]??0)<30){console.log('Waiting for 30% free memory.');await sleep(30000)}
check(Number(execFileSync('df',['-k','/System/Volumes/Data'],{encoding:'utf8'}).trim().split('\n').at(-1).trim().split(/\s+/)[3])>5*1024*1024,'Less than 5 GB free.');
const creds=JSON.parse(readFileSync(join(root,'.near-credentials/testnet.json'),'utf8'));
let secret=creds.rootId&&account.endsWith('.'+creds.rootId)?creds.subKey:creds.account_id===account?creds.private_key:null;check(secret&&account.endsWith('.testnet'),'Existing demo testnet signer required.');
const acct=await provider.viewAccount({accountId:account});const initialNear=BigInt(acct.amount);check(initialNear-BigInt(acct.storage_usage)*10n**19n>85n*10n**21n,'Demo NEAR balance too low for wallet prepaid gas.');
let reserved=0n,stage='';mkdirSync(dir,{recursive:true});save();
async function shot(p,name,w){
 const m=await p.evaluate(()=>({overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth,bad:/\bundefined\b|\bNaN\b|\bArc\b|Robinhood|CCTP|CCIP|NYSE/.test(document.body.innerText)}));
 const path=join(dir,`${prefix}-${name}-${w}.png`);await p.screenshot({path,fullPage:true,mask:[p.locator('.ob-keys dd,.sd-secret')]});report.screenshots.push({name,width:w,path,...m});save();if(m.overflow){report.checks.push({name,width:w,overflowElements:await p.locator('body *').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,class:e.getAttribute('class'),right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})))});save();}check(!m.overflow,'Horizontal overflow: '+name+' '+w);check(!m.bad,'Invalid visible copy: '+name);
}
await withChromeLock(async()=>{
 while(Number(/free percentage: (\d+)/.exec(execFileSync('memory_pressure',{encoding:'utf8'}))?.[1]??0)<30)await sleep(30000);
 const lock=LOCK;const heart=setInterval(()=>{try{if(existsSync(lock))utimesSync(lock,new Date(),new Date())}catch{}},30000);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const w of (process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:[1440,375])){
  const context=await browser.newContext({viewport:{width:w,height:1000},reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(35000);const errors=[];const pending=new Set();p.on('pageerror',()=>errors.push('page exception'));p.on('console',m=>{if(m.type()==='error')report.checks.push({width:w,stage,consoleError:true})});p.on('requestfailed',r=>{report.checks.push({width:w,stage,failedRequest:new URL(r.url()).hostname})});
  p.on('response',response=>{if(!response.url().startsWith('https://test.rpc.fastnear.com'))return;let q;try{q=response.request().postDataJSON()}catch{return}if(!['send_tx','broadcast_tx_commit','broadcast_tx_async'].includes(q?.method))return;const txStage=stage,t=(async()=>{const j=await response.json(),hash=j.result?.transaction?.hash??j.result?.transaction_outcome?.id??(typeof j.result==='string'?j.result:null);if(hash&&!report.transactions.some(t=>t.hash===hash)){report.transactions.push({width:w,source:'browser QA signer',stage:txStage,hash,explorer:`https://testnet.nearblocks.io/txns/${hash}`});save()}})().catch(()=>errors.push('hash capture failed'));pending.add(t);t.finally(()=>pending.delete(t));});
  await p.exposeFunction('__norenQaAuthorize',async request=>{
   check(live,'Read-only QA refuses a transaction.');const gp=BigInt((await provider.viewGasPrice()).gas_price);const cost=BigInt(request.gas)*gp*2n+BigInt(request.deposit);check(reserved+cost<=100n*10n**21n,'Edition QA budget cap 0.1 testnet NEAR reached.');reserved+=cost;report.attempts.push({stage,...request,maximumCostYocto:String(cost)});save();
  });
  await p.addInitScript(config=>{window.__NOREN_QA_SIGNER__=config},{accountId:account,privateKey:secret,rpcUrl:'https://test.rpc.fastnear.com'});
  if(process.env.QA_TARGET==='receipt'){
   check(/^0x[0-9a-f]{64}$/.test(process.env.NOREN_QA_INVOICE??''),'Set a public invoice ID.');await p.goto(base+'/#/pay/'+process.env.NOREN_QA_INVOICE);await p.locator('.co-amt').waitFor();const b=p.getByRole('button',{name:'Connect Meteor Wallet',exact:true});if(await b.count())await b.click();await shot(p,'existing-sale-receipt',w);report.checks.push({width:w,target:'receipt',status:'PASS'});save();await context.close();continue;
  }
  stage='landing navigation';await p.goto(base+'/#/');await p.getByRole('link',{name:'Read the API',exact:true}).click();await p.waitForTimeout(500);check(await p.locator('#developers').evaluate(e=>Math.abs(e.getBoundingClientRect().top)<150),'Landing developer link did not scroll.');await shot(p,'landing-api',w);stage='merchant sign-in';await p.goto(base+'/#/dashboard');await p.getByRole('button',{name:'Meteor Wallet',exact:false}).click();await p.getByRole('heading',{name:"What's your business called?"}).waitFor();await shot(p,'business',w);
  await p.getByPlaceholder('Chai Point, Bandra').fill(`Aubelle NEAR ${w}`);await p.getByRole('button',{name:'Continue',exact:false}).click();await shot(p,'payout',w);
  await p.getByRole('radio',{name:/another address/}).click();await p.getByPlaceholder('my-shop.testnet').fill(d.accounts.shop);await p.getByRole('button',{name:'Create store',exact:false}).click();await p.getByRole('heading',{name:'Create your first payment link'}).waitFor();await shot(p,'first-link',w);
  await p.getByLabel('Amount (USDC)',{exact:true}).fill('1');await p.getByPlaceholder('Masala chai, large').fill('NEAR browser receipt');await p.getByRole('button',{name:'Create link',exact:false}).click();await p.locator('.ob-url').waitFor();const checkout=await p.locator('.ob-url').innerText();report.checks.push({width:w,merchantAuthenticated:true,invoiceId:checkout.split('/pay/')[1]});save();await shot(p,'link-created',w);
  await p.getByRole('button',{name:'Continue',exact:false}).click();await p.getByRole('heading',{name:'Your API keys'}).waitFor();await shot(p,'keys-once-redacted',w);await p.getByRole('button',{name:'Go to your dashboard',exact:false}).click();
  for(const [name,path]of [['merchant-home','dashboard'],['balances','dashboard/balances'],['payments-empty','dashboard/payments'],['links','dashboard/links'],['developers','dashboard/developers'],['webhooks-unavailable','dashboard/developers/webhooks'],['events','dashboard/developers/events'],['settings','dashboard/settings']]){await p.evaluate(hash=>location.hash=hash,'#/'+path);await p.waitForTimeout(600);await shot(p,name,w)}
  await p.getByRole('button',{name:/Connect Aubelle/}).click();await p.waitForTimeout(500);
  await p.evaluate(()=>location.hash='#/dashboard/developers');await p.getByRole('button',{name:'Create secret key',exact:true}).click();await p.locator('.sd-secret').waitFor();await shot(p,'key-created-redacted',w);p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Revoke',exact:true}).last().click();await p.waitForTimeout(600);await shot(p,'key-revoked',w);
  await p.evaluate(()=>location.hash='#/dashboard/links');await p.getByRole('button',{name:'Create payment link',exact:true}).first().click();await p.getByRole('dialog').waitFor();await shot(p,'link-builder',w);
  if(process.env.QA_INVALID_AMOUNT==='1'){await p.locator('#cl-amt').fill('9'.repeat(400));check(await p.getByRole('button',{name:'Create link',exact:true}).isDisabled(),'Unsafe huge amount was accepted.');await shot(p,'link-builder-invalid',w);}
  await p.getByRole('button',{name:'Cancel',exact:true}).click();
  if(process.env.QA_TARGET==='builder'){await Promise.all([...pending]);check(errors.length===0,'Unhandled page exceptions.');report.checks.push({width:w,target:'builder',status:'PASS'});save();await context.close();continue;}
  await p.evaluate(hash=>location.hash=hash,new URL(checkout).hash);await p.getByRole('tab',{name:/Pay privately/}).click();await shot(p,'privacy-unavailable',w);await p.getByRole('tab',{name:/Pay with stocks/}).click();await shot(p,'stock-checkout',w);
  await p.getByRole('tab',{name:/Pay with USDC/}).click();await shot(p,'usdc-checkout',w);
  if(live){
   stage=`${cryptoMode?'WBTC':'USDC'} checkout ${w}`;
   if(process.argv.includes('--verify-retry')){
    let blocked=false;await p.route('**/api/invoices/*/complete',async route=>{if(!blocked){blocked=true;report.checks.push({width:w,expected:'injected receipt-network failure; chain payment remains real'});save();await route.abort('failed')}else await route.continue()});
   }
   if(cryptoMode){
    const quote=await fetchBtcSpot();const gas='30000000000000',cost=BigInt(gas)*BigInt((await provider.viewGasPrice()).gas_price)*2n;check(reserved+cost<=100n*10n**21n,'Edition QA budget reached.');reserved+=cost;report.attempts.push({stage:'BTC price',receiverId:d.accounts.credit,gas,deposit:'0',maximumCostYocto:String(cost)});save();
    const {message:_,...args}=signPrice(creds.relayerKey,d.accounts.credit,d.accounts.tbtc,quote.priceUsd6,quote.timestampNs,'https://api.exchange.coinbase.com/products/BTC-USD/ticker');const tx=await accountFor(account,secret).signAndSendTransaction({receiverId:d.accounts.credit,actions:[actions.functionCall('post_signed_price',args,BigInt(gas),0n)],waitUntil:'FINAL',throwOnFailure:false});report.transactions.push({width:w,source:'Node price relayer',stage:'BTC price',hash:tx.transaction.hash,final:!tx.status.Failure,args});save();check(!tx.status.Failure,'BTC price rejected.');
    await p.reload();await p.getByRole('tab',{name:/Pay with stocks/}).click();await p.getByRole('radio',{name:'test WBTC',exact:true}).click();const connect=p.getByRole('button',{name:'Connect Meteor Wallet',exact:true});if(await connect.count())await connect.click();await p.getByText('Coinbase quote, signed by Noren’s relayer — testnet',{exact:true}).waitFor();await shot(p,'crypto-quote',w);await p.getByRole('button',{name:'Sell test WBTC and pay 1.00',exact:true}).click();
   }else await p.getByRole('button',{name:'Pay 1.00 test USDC',exact:true}).click();
   if(process.argv.includes('--verify-retry')){
    await p.getByRole('button',{name:/Verify this existing transaction again/}).waitFor({timeout:90000});await p.getByRole('alert').waitFor();await shot(p,'receipt-network-failure',w);const attempts=report.attempts.length;await p.reload();await p.getByRole('button',{name:/Verify this existing transaction again/}).waitFor();await shot(p,'receipt-recovery-after-reload',w);await p.getByRole('button',{name:/Verify this existing transaction again/}).click();check(report.attempts.length===attempts,'Receipt retry submitted a new chain transaction.');
   }
   await p.getByRole('heading',{name:cryptoMode?'Paid with test crypto':'Paid with test USDC'}).waitFor({timeout:90000});const hash=new URL(await p.locator('.co-done a[href*="/txns/"]').getAttribute('href')).pathname.split('/').at(-1);const existing=report.transactions.find(t=>t.hash===hash);if(existing)Object.assign(existing,{final:true,stage});else report.transactions.push({width:w,source:'browser QA signer',stage,hash,final:true,explorer:`https://testnet.nearblocks.io/txns/${hash}`});save();await shot(p,cryptoMode?'crypto-final-receipt':'usdc-final-receipt',w);await p.evaluate(()=>location.hash='#/dashboard/payments');await p.getByRole('row').filter({hasText:'NEAR browser receipt'}).first().click();await p.waitForTimeout(400);await shot(p,'merchant-paid-receipt',w)
  }
  for(const tab of ['home','pay','earn','credit','borrow','swap']){await p.evaluate(h=>location.hash=h,'#/app/'+tab);await p.waitForTimeout(1100);if(tab==='home'){const connect=p.getByRole('button',{name:'Connect Meteor Wallet',exact:true});if(await connect.count())await connect.click();await p.locator('.nk-wallet').waitFor();}await shot(p,'app-'+tab,w)}
  await p.getByRole('button',{name:'Your wallet',exact:true}).click();await shot(p,'wallet-profile',w);await p.getByRole('button',{name:'Close',exact:true}).click();
  await p.goto(base+'/#/pay/malformed');await p.getByRole('heading',{name:"This payment link doesn't work"}).waitFor();await shot(p,'invalid-link',w);
  for(const [name,hash]of [['shop-home','/'],['shop-catalog','/shop'],['shop-filter','/shop?tag=New'],['shop-product','/p/amelie-gingham'],['shop-empty-bag','/bag'],['shop-integration','/noren'],['shop-missing-product','/p/missing'],['shop-missing-order','/order/missing']]){await p.goto(base+'/shop/#'+hash);await p.waitForTimeout(600);await shot(p,name,w)}
  await p.goto(base+'/shop/#/p/amelie-gingham');await p.getByRole('button',{name:'S',exact:true}).click();await p.getByRole('button',{name:/Add to bag/}).click();await shot(p,'shop-bag-drawer',w);await p.goto(base+'/shop/#/bag');await shot(p,'shop-filled-bag',w);
  await p.getByRole('button',{name:/Checkout with Noren/}).click();await p.waitForURL(/#\/pay\/0x/);await p.locator('.co-amt').waitFor();await shot(p,'shop-hosted-checkout',w);
  await Promise.all([...pending]);check(errors.length===0,'Unhandled page exceptions.');report.checks.push({width:w,pageErrors:errors,status:'PASS'});save();await context.close();
 }}finally{clearInterval(heart);await browser.close()}
},{owner:'noren-near ETHGlobal port regression'}).catch(e=>{report.status='FAIL';report.failedStage=stage;report.error=e.message;save();throw Error(e.message)});
secret='';creds.subKey='';creds.private_key='';const final=await provider.viewAccount({accountId:account});report.actualNearSpentYocto=String(initialNear-BigInt(final.amount));report.reservedYocto=String(reserved);report.status='PASS';save();console.log(JSON.stringify({status:report.status,screenshots:report.screenshots.length,transactions:report.transactions,report:file}));
