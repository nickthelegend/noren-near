// Existing owned accounts only. Default is read-only; --execute enables the reviewed deployment plan.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { actions, KeyPair, PublicKey, JsonRpcProvider, baseDecode } from 'near-api-js';
import { accountFor, loadCreds, loadDeployment, provider, view } from './near-lib.ts';
import { STOCK_FEEDS, stockAccount } from '../packages/sdk/src/stocks.ts';
const root=resolve(import.meta.dirname,'..'), CAP=10n**24n;
const TEMPLATE='3vaopJ7aRoivvzZLngPQRBEd8VJr2zPLTxQfnRCoFgNX';
const file=resolve(root,'deployments/stock-demo-2026-11-12.json');
let stage='preflight', ledger, reserved=0n;
const save=()=>{if(ledger)writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');};
const check=(ok,message)=>{if(!ok)throw Error(message);};
async function main(){
 check(process.argv.slice(2).every(x=>x==='--execute'),'Use optional --execute only.');
 const d=loadDeployment();check(d?.network==='testnet'&&d.root.endsWith('.testnet'),'Testnet deployment required.');
 const wasm=readFileSync(resolve(root,'packages/contract/target/near/noren_credit.wasm'));
 const config=await view(d.accounts.credit,'config',{});
 const current=await provider.viewAccount({accountId:d.accounts.credit});
 const payer=await provider.viewAccount({accountId:d.root});
 const template=await provider.viewGlobalContractCode({identifier:{codeHash:TEMPLATE}});
 check(template.hash===TEMPLATE,'Immutable FT template hash mismatch.');
 const keyList=await provider.viewAccessKeyList({accountId:d.accounts.credit});
 check(keyList.keys.some(k=>k.access_key.permission==='FullAccess'),'No credit upgrade key; v2 deployment must be planned instead.');
 const tokens=STOCK_FEEDS.map(x=>({...x,account:stockAccount(x.symbol,d.root),decimals:8,ltvBps:4000,liquidationBps:5000,totalSupply:'10000000000'}));
 console.log(JSON.stringify({network:'testnet',credit:d.accounts.credit,schema:config.schema_version??1,immutableFtTemplate:TEMPLATE,tokens:tokens.map(x=>({symbol:x.symbol,account:x.account,name:x.name})),budgetNear:1,rootBalanceNear:Number(payer.amount)/1e24},null,2));
 if(!process.argv.includes('--execute'))return;

 const c=loadCreds();check(c&&c.rootId===d.root,'Existing owned demo credential file required.');
 let rootSigner,creditSigner,pk;
 try{rootSigner=accountFor(d.root,c.rootKey);creditSigner=accountFor(d.accounts.credit,c.subKey);pk=PublicKey.fromString(KeyPair.fromString(c.subKey).getPublicKey().toString());}catch{throw Error('Credential file could not initialize the owned signers.');}
 check(keyList.keys.some(k=>String(k.public_key)===pk.toString()&&k.access_key.permission==='FullAccess'),'Owned credit upgrade key not found.');
 ledger=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{network:'testnet',startedAt:new Date().toISOString(),budgetNear:1,template:{hash:TEMPLATE,source:'https://github.com/near-examples/factory-rust'},tokens,steps:[],before:{config,pool:await view(d.accounts.credit,'pool_status',{}),alice:await view(d.accounts.credit,'position',{borrower:d.accounts.alice}),bob:await view(d.accounts.credit,'position',{borrower:d.accounts.bob})},reservedYocto:'0'};
 reserved=BigInt(ledger.reservedYocto);ledger.status='RUNNING';save();
 async function send(label,signer,receiverId,acts,gas,deposit=0n,extraStorage=0n){
  stage=label;check(receiverId.endsWith('.testnet'),'Non-testnet receiver refused.');
  const account=await provider.viewAccount({accountId:signer.accountId});
  const usable=account.amount-BigInt(account.storage_usage)*10n**19n;
  const response=await fetch('https://test.rpc.fastnear.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'stock-budget',method:'gas_price',params:[null]})});
  check(response.status!==429,'Rate limited; stop with no further writes.');const j=await response.json();check(response.ok&&j.result,'Gas price unavailable.');
  const gasFloor=BigInt(j.result.gas_price)>1_000_000_000n?BigInt(j.result.gas_price):1_000_000_000n;
  const maximum=BigInt(gas)*gasFloor+deposit+extraStorage;
  check(usable>maximum,'Low account balance; no further writes.');check(reserved+maximum<CAP,'One-NEAR cumulative budget would be exceeded.');
  reserved+=maximum;ledger.reservedYocto=reserved.toString();save();
  let tx;
  try { tx=await signer.signAndSendTransaction({receiverId,actions:acts,waitUntil:'FINAL',throwOnFailure:false}); }
  catch(error) {
   let message=String(error?.message??'Submission failed').split('\n')[0];
   for(const secret of [c.rootKey,c.subKey,c.relayerKey])message=message.replaceAll(secret,'[redacted]');
   ledger.submissionError={stage,type:String(error?.type??error?.name??'unknown'),message:message.slice(0,600)};save();throw Error('Submission stopped.');
  }
  const fee=[tx.transaction_outcome,...tx.receipts_outcome].reduce((n,x)=>n+BigInt(x.outcome.tokens_burnt),0n);
  ledger.steps.push({step:label,account:signer.accountId,receiverId,hash:tx.transaction.hash,status:tx.status.Failure?'rejected':'success',explorer:`https://testnet.nearblocks.io/txns/${tx.transaction.hash}`,feeYocto:fee.toString(),allocatedYocto:deposit.toString()});save();
  check(!tx.status.Failure,'Transaction rejected; inspect the recorded public hash.');console.log(label+' FINAL '+tx.transaction.hash);
 }
 if(!config.schema_version){
  const available=current.amount-BigInt(current.storage_usage)*10n**19n;
  if(available<210_000_000_000_000_000_000_000n)await send('Reserve storage and prepaid gas for credit upgrade',rootSigner,d.accounts.credit,[actions.transfer(90_000_000_000_000_000_000_000n)],1_000_000_000_000n,90_000_000_000_000_000_000_000n);
  const delta=BigInt(Math.max(0,wasm.length-Number(current.storage_usage)+1000))*10n**19n;
  await send('Upgrade credit and migrate v1 state',creditSigner,d.accounts.credit,[actions.deployContract(wasm),actions.functionCall('migrate',{},100_000_000_000_000n,0n)],160_000_000_000_000n,0n,delta);
 }
 const migrated=await view(d.accounts.credit,'config',{});check(migrated.schema_version===2,'Migration version check failed.');
 check(JSON.stringify(await view(d.accounts.credit,'pool_status',{}))===JSON.stringify(ledger.before.pool),'Pool state changed during migration.');
 for(const token of tokens){
  let present=false;try{await provider.viewAccount({accountId:token.account});present=true;}catch{}
  if(!present){
   const payerNow=await provider.viewAccount({accountId:d.root});
   if(payerNow.amount-BigInt(payerNow.storage_usage)*10n**19n<95_000_000_000_000_000_000_000n){
    const creditNow=await provider.viewAccount({accountId:d.accounts.credit});
    const spare=creditNow.amount-BigInt(creditNow.storage_usage)*10n**19n-80_000_000_000_000_000_000_000n;
    if(spare>61_000_000_000_000_000_000_000n)await send('Return unused upgrade gas reserve to owned root',creditSigner,d.root,[actions.transfer(60_000_000_000_000_000_000_000n)],1_000_000_000_000n,60_000_000_000_000_000_000_000n);
   }
   const metadata={spec:'ft-1.0.0',name:token.name,symbol:token.symbol,decimals:8,icon:null,reference:null,reference_hash:null};
   await send('Create '+token.symbol+' (TEST, not real shares)',rootSigner,token.account,[actions.createAccount(),actions.transfer(10_000_000_000_000_000_000_000n),actions.addFullAccessKey(pk),actions.useGlobalContract({codeHash:baseDecode(TEMPLATE)}),actions.functionCall('new',{owner_id:d.accounts.alice,total_supply:token.totalSupply,metadata},30_000_000_000_000n,0n)],80_000_000_000_000n,10_000_000_000_000_000_000_000n);
  }
  const meta=await view(token.account,'ft_metadata',{});check(meta.symbol===token.symbol&&meta.name===token.name&&meta.decimals===8,'Test token metadata mismatch.');
  if(!await view(token.account,'storage_balance_of',{account_id:d.accounts.credit}))await send('Register credit for '+token.symbol,rootSigner,token.account,[actions.functionCall('storage_deposit',{account_id:d.accounts.credit,registration_only:true},10_000_000_000_000n,1_250_000_000_000_000_000_000n)],15_000_000_000_000n,1_250_000_000_000_000_000_000n);
  const assets=await view(d.accounts.credit,'assets',{});
  if(!assets.some(a=>a.token===token.account&&a.ltv_bps===4000))await send('Configure '+token.symbol+' at 40% LTV',rootSigner,d.accounts.credit,[actions.functionCall('configure_asset',{token:token.account,decimals:8,ltv_bps:4000},30_000_000_000_000n,0n)],35_000_000_000_000n);
  token.metadata=meta;token.demoBalance=await view(token.account,'ft_balance_of',{account_id:d.accounts.alice});check(BigInt(token.demoBalance)>0n,'Demo stock mint missing.');
 }
 ledger.tokens=tokens;ledger.creditCodeSha256=createHash('sha256').update(wasm).digest('hex');
 ledger.after={config:await view(d.accounts.credit,'config',{}),pool:await view(d.accounts.credit,'pool_status',{}),assets:await view(d.accounts.credit,'assets',{}),alice:await view(d.accounts.credit,'position',{borrower:d.accounts.alice}),bob:await view(d.accounts.credit,'position',{borrower:d.accounts.bob})};
 for(const name of ['alice','bob'])check(JSON.stringify(ledger.before[name].collateral)===JSON.stringify(ledger.after[name].collateral),'Migration collateral preservation failed.');
 ledger.totalFeesYocto=ledger.steps.reduce((n,x)=>n+BigInt(x.feeYocto),0n).toString();ledger.allocatedYocto=ledger.steps.reduce((n,x)=>n+BigInt(x.allocatedYocto),0n).toString();
 ledger.status='SETUP_READY_PRICES_REQUIRED';ledger.finishedAt=new Date().toISOString();save();
 console.log(JSON.stringify({status:ledger.status,feesNear:Number(ledger.totalFeesYocto)/1e24,allocatedNear:Number(ledger.allocatedYocto)/1e24,reservedNear:Number(reserved)/1e24}));
}
try{await main();}catch{if(ledger){ledger.status='BLOCKED';ledger.error='Stopped during '+stage+'. No credential or raw provider details are recorded.';save();}console.error('Stock setup stopped during '+stage+'. Check the public evidence and account funding.');process.exitCode=1;}
