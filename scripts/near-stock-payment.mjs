// Real stock-only credit cycle. Key material stays in the existing credential file / Node memory.
import { existsSync, writeFileSync } from 'node:fs';
import { actions } from 'near-api-js';
import { equityPrices } from './equity-source.ts';
import { stockAccount } from '../packages/sdk/src/stocks.ts';
import { loadDeployment, loadCreds, accountFor, provider, view, signPrice } from './near-lib.ts';
import { runCreditAction } from '../packages/web/src/near/credit-runtime.ts';
import { walletError } from '../packages/web/src/near/credit-calls.ts';
import { EQUITY_BUDGET_GROUP, assertEquityBudget } from './equity-budget.mjs';
const file=`deployments/stock-payment-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
const check=(ok,msg)=>{if(!ok)throw Error(msg)};let ledger,stage='preflight';const save=()=>{if(ledger)writeFileSync(file,JSON.stringify(ledger,null,2)+'\n')};
try{
 check(!existsSync(file),'Existing stock-payment evidence is sealed; use a new run filename.');
 const d=loadDeployment();check(d?.network==='testnet','Testnet deployment required.');const account=d.accounts.alice,c={credit:d.accounts.credit,collateral:stockAccount('tTSLA',d.root),usdc:d.accounts.tusdc};
 const quote=(await equityPrices(['tTSLA']))[0];check(quote.fresh,'Stock market is closed or the quote is older than 90 seconds; stopped without spending.');
 const state=await provider.viewAccount({accountId:account});check(state.amount-BigInt(state.storage_usage)*10n**19n>90_000_000_000_000_000_000_000n,'Low testnet NEAR; stopped without spending.');
 const pos=()=>view(c.credit,'position',{borrower:account}),balance=(token,who=account)=>view(token,'ft_balance_of',{account_id:who});
 const initial=await pos();check(initial.debt_usd6==='0'&&initial.collateral.length===0,'Demo account must start debt-free and unlocked.');
 const before={stock:await balance(c.collateral),usdc:await balance(c.usdc),shop:await balance(c.usdc,d.accounts.shop),position:initial};check(BigInt(before.stock)>=100_000_000n,'Insufficient preissued tTSLA.');
 assertEquityBudget(100_000_000_000_000_000_000_000n);
 const creds=loadCreds();check(creds&&creds.rootId===d.root,'Existing demo credential file required.');const signer=accountFor(account,creds.subKey);
 ledger={network:'testnet',budgetGroup:EQUITY_BUDGET_GROUP,budgetNear:0.5,account,startedAt:new Date().toISOString(),status:'RUNNING',quote,before,reservedYocto:'0',transactions:[]};save();
 async function send(call){
  check(call.receiverId.endsWith('.testnet'),'Non-testnet call refused.');
  const response=await fetch('https://test.rpc.fastnear.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'equity-budget',method:'gas_price',params:[null]})});check(response.status!==429,'Rate limited; stopped.');const j=await response.json();check(response.ok&&j.result,'Gas price unavailable.');
  const cost=BigInt(call.gas)*BigInt(j.result.gas_price)*2n+BigInt(call.deposit);assertEquityBudget(cost);ledger.reservedYocto=(BigInt(ledger.reservedYocto)+cost).toString();save();
  const tx=await signer.signAndSendTransaction({receiverId:call.receiverId,actions:[actions.functionCall(call.methodName,call.args,BigInt(call.gas),BigInt(call.deposit))],waitUntil:'FINAL',throwOnFailure:false});
  const fee=[tx.transaction_outcome,...tx.receipts_outcome].reduce((n,r)=>n+BigInt(r.outcome.tokens_burnt),0n);
  ledger.transactions.push({stage,receiverId:call.receiverId,method:call.methodName,args:call.args,hash:tx.transaction.hash,final:!tx.status.Failure,feeYocto:fee.toString(),explorer:`https://testnet.nearblocks.io/txns/${tx.transaction.hash}`});save();check(!tx.status.Failure,'Transaction rejected; check the public hash.');console.log(stage+' FINAL '+tx.transaction.hash);return tx;
 }
 if(BigInt(before.usdc)<75_000_000n){stage='mint public test USDC for three repayments';await send({receiverId:c.usdc,methodName:'mint',args:{account_id:account,amount:'100000000'},gas:'20000000000000',deposit:'0'});}
 stage='post fresh stock price';const{message:_,...price}=signPrice(creds.relayerKey,c.credit,c.collateral,BigInt(quote.priceUsd6),BigInt(quote.timestampNs),quote.source);await send({receiverId:c.credit,methodName:'post_signed_price',args:price,gas:'30000000000000',deposit:'0'});
 const adapter={account,sign:send};stage='deposit 1 tTSLA';await runCreditAction('deposit',c,'100000000',account,adapter);
 stage='borrow 25 test USDC and pay shop';await runCreditAction('borrow',c,'25000000',d.accounts.shop,adapter);
 ledger.drawn=await pos();ledger.shopAfterPayment=await balance(c.usdc,d.accounts.shop);save();check(BigInt(ledger.shopAfterPayment)-BigInt(before.shop)===25_000_000n,'Merchant payment mismatch.');check(BigInt(ledger.drawn.health_bps??'0')>10000n,'Position is not healthy.');
 stage='repay stock credit';await runCreditAction('repay',c,'25010000',account,adapter);
 stage='withdraw 1 tTSLA';await runCreditAction('withdraw',c,'100000000',account,adapter);
 ledger.after={stock:await balance(c.collateral),usdc:await balance(c.usdc),shop:await balance(c.usdc,d.accounts.shop),position:await pos()};check(ledger.after.stock===before.stock&&ledger.after.position.debt_usd6==='0'&&ledger.after.position.collateral.length===0,'Final position/token restoration failed.');ledger.status='PASS';
}catch(error){if(ledger){ledger.status='FAILED';ledger.error=walletError(error);}const message=/^(Yahoo Finance|Pyth Hermes|Stock market|Low testnet NEAR|Demo account|Insufficient preissued|Equity continuation|Existing stock)/.test(error?.message??'')?error.message:walletError(error);console.error('Stock payment stopped at '+stage+': '+message);process.exitCode=1;}
finally{if(ledger){ledger.finishedAt=new Date().toISOString();ledger.feesYocto=ledger.transactions.reduce((n,t)=>n+BigInt(t.feeYocto),0n).toString();ledger.budgetChargedYocto=(BigInt(ledger.feesYocto)+2n).toString();save();console.log(JSON.stringify({status:ledger.status,feesNear:Number(ledger.feesYocto)/1e24,evidence:file}));}}
