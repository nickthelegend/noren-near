import { equityPrices } from './equity-source.ts';
import { stockAccount } from '../packages/sdk/src/stocks.ts';
import { accountFor, loadCreds, loadDeployment, provider, signPrice } from './near-lib.ts';
import { actions } from 'near-api-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const d=loadDeployment();if(!d||d.network!=='testnet')throw Error('NEAR testnet deployment required.');
const prices=await equityPrices();
if(process.argv.includes('--check')){console.log(JSON.stringify(prices,null,2));process.exit(0);}
const fresh=prices.filter(p=>p.fresh);if(!fresh.length)throw Error('US-equity market is closed or quotes are older than 90 seconds; no price was re-timestamped or sent.');
const creds=loadCreds();if(!creds)throw Error('Operator credentials required by file path.');
const file='deployments/stock-relay-'+new Date().toISOString().slice(0,10)+'.json';
const ledger=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{network:'testnet',steps:[],observations:[]};ledger.observations.push({at:new Date().toISOString(),prices});
const signer=accountFor(creds.rootId,creds.rootKey);
for(const price of fresh){
 const balance=await provider.viewAccount({accountId:creds.rootId});if(balance.amount-BigInt(balance.storage_usage)*10n**19n<35_000_000_000_000_000_000_000n)throw Error('Low testnet NEAR; no further price sent.');
 const {message:_,...args}=signPrice(creds.relayerKey,d.accounts.credit,stockAccount(price.symbol,d.root),BigInt(price.priceUsd6),BigInt(price.timestampNs),price.source);
 const tx=await signer.signAndSendTransaction({receiverId:d.accounts.credit,actions:[actions.functionCall('post_signed_price',args,30_000_000_000_000n,0n)],waitUntil:'FINAL',throwOnFailure:false});
 ledger.steps.push({symbol:price.symbol,hash:tx.transaction.hash,status:tx.status.Failure?'failed':'FINAL',source:price.source,publishTime:price.publishTime});writeFileSync(file,JSON.stringify(ledger,null,2)+'\n');
 if(tx.status.Failure)throw Error('Signed stock price was rejected. See the public transaction.');
 console.log(price.symbol+' FINAL https://testnet.nearblocks.io/txns/'+tx.transaction.hash);
}
