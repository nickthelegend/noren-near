/** Real merchant authentication and NEAR-edition browser regression. No trace/HAR/key copies. */
import {readFileSync,writeFileSync,mkdirSync,utimesSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {loadDeployment,view,provider} from './near-lib.ts';
const root=resolve(import.meta.dirname,'..'),base=process.env.NOREN_QA_ORIGIN??'http://127.0.0.1:5395';
if(!/^http:\/\/(127\.0\.0\.1|localhost):5[3-9]\d\d$/.test(base))throw Error('Loopback QA origin on ports 5300–5999 required.');
const {withChromeLock,LOCK}=await import(resolve(root,'../../orchestration/chrome-lock.mjs'));
const dir=resolve(root,'../../orchestration/shots/noren-near/ethglobal-port'),d=loadDeployment(),account=d.accounts.alice;
const live=process.argv.includes('--live-usdc'),prefix=process.env.QA_PREFIX??'edition';
const file=join(root,`deployments/ethglobal-browser-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
const report={network:'testnet',startedAt:new Date().toISOString(),account,liveUsdc:live,status:'RUNNING',screenshots:[],transactions:[],checks:[],attempts:[]};
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
 const lock=LOCK;const heart=setInterval(()=>{try{if(existsSync(lock))utimesSync(lock,new Date(),new Date())}catch{}},30000);
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const w of (process.env.QA_WIDTH?[Number(process.env.QA_WIDTH)]:[1440,375])){
  const context=await browser.newContext({viewport:{width:w,height:1000},reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(35000);const errors=[];p.on('pageerror',()=>errors.push('page exception'));p.on('console',m=>{if(m.type()==='error')report.checks.push({width:w,stage,consoleError:true})});p.on('requestfailed',r=>{report.checks.push({width:w,stage,failedRequest:new URL(r.url()).hostname})});
  await p.exposeFunction('__norenQaAuthorize',async request=>{
   check(live,'Read-only QA refuses a transaction.');const gp=BigInt((await provider.viewGasPrice()).gas_price);const cost=BigInt(request.gas)*gp*2n+BigInt(request.deposit);check(reserved+cost<=100n*10n**21n,'Edition QA budget cap 0.1 testnet NEAR reached.');reserved+=cost;report.attempts.push({stage,...request,maximumCostYocto:String(cost)});save();
  });
  await p.addInitScript(config=>{window.__NOREN_QA_SIGNER__=config},{accountId:account,privateKey:secret,rpcUrl:'https://test.rpc.fastnear.com'});
  stage='landing navigation';await p.goto(base+'/#/');await p.getByRole('link',{name:'Read the API',exact:true}).click();await p.waitForTimeout(500);check(await p.locator('#developers').evaluate(e=>Math.abs(e.getBoundingClientRect().top)<150),'Landing developer link did not scroll.');await shot(p,'landing-api',w);stage='merchant sign-in';await p.goto(base+'/#/dashboard');await p.getByRole('button',{name:'Meteor Wallet',exact:false}).click();await p.getByRole('heading',{name:"What's your business called?"}).waitFor();await shot(p,'business',w);
  await p.getByPlaceholder('Chai Point, Bandra').fill(`Aubelle NEAR ${w}`);await p.getByRole('button',{name:'Continue',exact:false}).click();await shot(p,'payout',w);
  await p.getByRole('radio',{name:/another address/}).click();await p.getByPlaceholder('my-shop.testnet').fill(d.accounts.shop);await p.getByRole('button',{name:'Create store',exact:false}).click();await p.getByRole('heading',{name:'Create your first payment link'}).waitFor();await shot(p,'first-link',w);
  await p.getByLabel('Amount (USDC)',{exact:true}).fill('1');await p.getByPlaceholder('Masala chai, large').fill('NEAR browser receipt');await p.getByRole('button',{name:'Create link',exact:false}).click();await p.locator('.ob-url').waitFor();const checkout=await p.locator('.ob-url').innerText();report.checks.push({width:w,merchantAuthenticated:true,invoiceId:checkout.split('/pay/')[1]});save();await shot(p,'link-created',w);
  await p.getByRole('button',{name:'Continue',exact:false}).click();await p.getByRole('heading',{name:'Your API keys'}).waitFor();await shot(p,'keys-once-redacted',w);await p.getByRole('button',{name:'Go to your dashboard',exact:false}).click();
  for(const [name,path]of [['merchant-home','dashboard'],['balances','dashboard/balances'],['payments-empty','dashboard/payments'],['links','dashboard/links'],['developers','dashboard/developers'],['webhooks-unavailable','dashboard/developers/webhooks'],['events','dashboard/developers/events'],['settings','dashboard/settings']]){await p.evaluate(hash=>location.hash=hash,'#/'+path);await p.waitForTimeout(600);await shot(p,name,w)}
  await p.getByRole('button',{name:/Connect Aubelle/}).click();await p.waitForTimeout(500);
  await p.evaluate(()=>location.hash='#/dashboard/developers');await p.getByRole('button',{name:'Create secret key',exact:true}).click();await p.locator('.sd-secret').waitFor();await shot(p,'key-created-redacted',w);p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Revoke',exact:true}).last().click();await p.waitForTimeout(600);await shot(p,'key-revoked',w);
  await p.evaluate(hash=>location.hash=hash,new URL(checkout).hash);await p.getByRole('tab',{name:/Pay privately/}).click();await shot(p,'privacy-unavailable',w);await p.getByRole('tab',{name:/Pay with stocks/}).click();await shot(p,'stock-checkout',w);
  await p.getByRole('tab',{name:/Pay with USDC/}).click();await shot(p,'usdc-checkout',w);
  if(live){stage=`USDC checkout ${w}`;await p.getByRole('button',{name:'Pay 1.00 test USDC',exact:true}).click();await p.getByRole('heading',{name:'Paid with test USDC'}).waitFor({timeout:90000});const hash=new URL(await p.locator('.co-done a[href*="/txns/"]').getAttribute('href')).pathname.split('/').at(-1);report.transactions.push({width:w,stage,hash,explorer:`https://testnet.nearblocks.io/txns/${hash}`});save();await shot(p,'usdc-final-receipt',w);await p.evaluate(()=>location.hash='#/dashboard/payments');await p.getByRole('row').filter({hasText:'NEAR browser receipt'}).first().click();await shot(p,'merchant-paid-receipt',w)}
  for(const tab of ['home','pay','earn','credit','borrow','swap']){await p.evaluate(h=>location.hash=h,'#/app/'+tab);await p.waitForTimeout(1100);await shot(p,'app-'+tab,w)}
  await p.getByRole('button',{name:'Your wallet',exact:true}).click();await shot(p,'wallet-profile',w);await p.getByRole('button',{name:'Close',exact:true}).click();
  await p.goto(base+'/#/pay/malformed');await p.getByRole('heading',{name:"This payment link doesn't work"}).waitFor();await shot(p,'invalid-link',w);
  for(const [name,hash]of [['shop-home','/'],['shop-catalog','/shop'],['shop-filter','/shop?tag=New'],['shop-product','/p/amelie-gingham'],['shop-empty-bag','/bag'],['shop-integration','/noren'],['shop-missing-product','/p/missing'],['shop-missing-order','/order/missing']]){await p.goto(base+'/shop/#'+hash);await p.waitForTimeout(600);await shot(p,name,w)}
  await p.goto(base+'/shop/#/p/amelie-gingham');await p.getByRole('button',{name:'S',exact:true}).click();await p.getByRole('button',{name:/Add to bag/}).click();await shot(p,'shop-bag-drawer',w);await p.goto(base+'/shop/#/bag');await shot(p,'shop-filled-bag',w);
  await p.getByRole('button',{name:/Checkout with Noren/}).click();await p.waitForURL(/#\/pay\/0x/);await p.locator('.co-amt').waitFor();await shot(p,'shop-hosted-checkout',w);
  check(errors.length===0,'Unhandled page exceptions.');report.checks.push({width:w,pageErrors:errors,status:'PASS'});save();await context.close();
 }}finally{clearInterval(heart);await browser.close()}
},{owner:'noren-near ETHGlobal port regression'}).catch(e=>{report.status='FAIL';report.failedStage=stage;report.error=e.message;save();throw Error(e.message)});
secret='';creds.subKey='';creds.private_key='';const final=await provider.viewAccount({accountId:account});report.actualNearSpentYocto=String(initialNear-BigInt(final.amount));report.reservedYocto=String(reserved);report.status='PASS';save();console.log(JSON.stringify({status:report.status,screenshots:report.screenshots.length,transactions:report.transactions,report:file}));
