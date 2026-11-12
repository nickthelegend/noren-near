// Explicit recovery for an interrupted browser cycle; no fresh price is needed to repay.
import {writeFileSync} from 'node:fs';
import {actions} from 'near-api-js';
import {loadDeployment,loadCreds,provider,view,accountFor} from './near-lib.ts';
import {runCreditAction} from '../packages/web/src/near/credit-runtime.ts';
import {walletError} from '../packages/web/src/near/credit-calls.ts';
import {EQUITY_BUDGET_GROUP,assertEquityBudget} from './equity-budget.mjs';
const file=`deployments/stock-payment-recovery-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;let ledger,stage='preflight';const save=()=>ledger&&writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
try{
 const d=loadDeployment(),id=d.accounts.alice;const before=await view(d.accounts.credit,'position',{borrower:id});console.log('Recovery plan: repay debt and return locked collateral on testnet.');
 if(!process.argv.includes('--execute'))process.exit(0);
 const creds=loadCreds(),alice=accountFor(id,creds.subKey),root=accountFor(d.root,creds.rootKey);if(d.network!=='testnet'||!id.endsWith('.testnet'))throw Error('Testnet required.');
 ledger={network:'testnet',budgetGroup:EQUITY_BUDGET_GROUP,startedAt:new Date().toISOString(),status:'RUNNING',before,reservedYocto:'0',allocatedYocto:'0',transactions:[]};save();
 async function send(signer,receiver,acts,gas,deposit=0n){
  if(!receiver.endsWith('.testnet'))throw Error('Testnet required.');const response=await fetch('https://test.rpc.fastnear.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'recovery-gas',method:'gas_price',params:[null]})});if(!response.ok)throw Error('Gas price unavailable; stopped.');const json=await response.json();if(!json.result)throw Error('Gas price unavailable; stopped.');const g=json.result;const cost=gas*BigInt(g.gas_price)*2n+deposit;assertEquityBudget(cost);ledger.reservedYocto=(BigInt(ledger.reservedYocto)+cost).toString();save();
  const tx=await signer.signAndSendTransaction({receiverId:receiver,actions:acts,waitUntil:'FINAL',throwOnFailure:false});const fee=[tx.transaction_outcome,...tx.receipts_outcome].reduce((n,r)=>n+BigInt(r.outcome.tokens_burnt),0n);ledger.transactions.push({stage,account:signer.accountId,hash:tx.transaction.hash,final:!tx.status.Failure,feeYocto:fee.toString(),allocatedYocto:deposit.toString(),explorer:`https://testnet.nearblocks.io/txns/${tx.transaction.hash}`});ledger.allocatedYocto=(BigInt(ledger.allocatedYocto)+deposit).toString();save();if(tx.status.Failure)throw Error('Recovery transaction failed.');console.log(stage+' FINAL '+tx.transaction.hash);return tx;
 }
 const state=await provider.viewAccount({accountId:id});if(state.amount-BigInt(state.storage_usage)*10n**19n<120_000_000_000_000_000_000_000n){stage='transfer owned testnet reserve to demo signer';await send(root,id,[actions.transfer(40_000_000_000_000_000_000_000n)],1_000_000_000_000n,40_000_000_000_000_000_000_000n);}
 const adapter={account:id,sign:call=>send(alice,call.receiverId,[actions.functionCall(call.methodName,call.args,BigInt(call.gas),BigInt(call.deposit))],BigInt(call.gas),BigInt(call.deposit))};
 if(BigInt(before.debt_usd6)>0n){stage='repay interrupted browser debt';await runCreditAction('repay',{credit:d.accounts.credit,collateral:d.accounts.tbtc,usdc:d.accounts.tusdc},(BigInt(before.debt_usd6)+1000n).toString(),id,adapter);}
 for(const token of before.collateral){stage='withdraw '+token.token;await runCreditAction('withdraw',{credit:d.accounts.credit,collateral:token.token,usdc:d.accounts.tusdc},token.amount,id,adapter);}
 ledger.after=await view(d.accounts.credit,'position',{borrower:id});if(ledger.after.debt_usd6!=='0'||ledger.after.collateral.length)throw Error('Recovery incomplete.');ledger.status='PASS';
}catch(e){if(ledger){ledger.status='FAILED';ledger.error=walletError(e);}console.error('Recovery stopped at '+stage+'. No raw credential or provider data is printed.');process.exitCode=1;}
finally{if(ledger){ledger.feesYocto=ledger.transactions.reduce((n,t)=>n+BigInt(t.feeYocto),0n).toString();ledger.budgetChargedYocto=(BigInt(ledger.feesYocto)+BigInt(ledger.allocatedYocto)).toString();ledger.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:ledger.status,evidence:file}));}}
