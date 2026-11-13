// One-time testnet upgrade. Keys load by existing file path; never print them or provider request dumps.
import{readFileSync,writeFileSync,existsSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';import{actions}from'near-api-js';
import{loadDeployment,loadCreds,accountFor,provider,view,root}from'./near-lib.ts';
const path=resolve(root,'deployments/market-upgrade-2026-11-13.json');if(existsSync(path))throw Error('Upgrade ledger already exists; inspect it before taking any action.');
const d=loadDeployment(),c=loadCreds(),contract=d.accounts.credit,wasm=readFileSync(resolve(root,'packages/contract/target/near/noren_credit.wasm'));
if(d.network!=='testnet'||!c)throw Error('Testnet deployment and existing credentials required.');
const config=await view(contract,'config');if(config.schema_version!==2)throw Error('Only the verified v2 state may be migrated.');
const before={config,assets:await view(contract,'assets'),pool:await view(contract,'pool_status'),alice:await view(contract,'position',{borrower:d.accounts.alice}),bob:await view(contract,'position',{borrower:d.accounts.bob})};
const R={network:'testnet',status:'RUNNING',wasmSha256:createHash('sha256').update(wasm).digest('hex'),bytes:wasm.length,before,transactions:[],maximumGasAndStorageNEAR:.3,internalTransfersNEAR:0,startedAt:new Date().toISOString()};const save=()=>writeFileSync(path,JSON.stringify(R,null,2)+'\n');save();
async function usable(id){const a=await provider.viewAccount({accountId:id});return a.amount-BigInt(a.storage_usage)*10n**19n}
async function send(label,signer,receiverId,acts){const r=await signer.signAndSendTransaction({receiverId,actions:acts,waitUntil:'FINAL',throwOnFailure:false});R.transactions.push({label,account:signer.accountId,receiverId,hash:r.transaction.hash,final:!r.status.Failure,explorer:`https://testnet.nearblocks.io/txns/${r.transaction.hash}`,feeYocto:String([r.transaction_outcome,...r.receipts_outcome].reduce((a,o)=>a+BigInt(o.outcome.tokens_burnt),0n))});save();if(r.status.Failure)throw Error('Testnet action failed; inspect ledger before retrying.');console.log(label,r.transaction.hash);return r}
try{
 const rootSigner=accountFor(d.root,c.rootKey),bob=accountFor(d.accounts.bob,c.subKey),credit=accountFor(contract,c.subKey);
 const state=await provider.viewAccount({accountId:contract});
 const estimatedExtraStorage=BigInt(Math.max(0,wasm.length-state.storage_usage+5000))*10n**19n;
 if(estimatedExtraStorage>260_000_000_000_000_000_000_000n)throw Error('Upgrade exceeds the 0.3 NEAR storage/gas cap.');
 if(await usable(d.root)<45_000_000_000_000_000_000_000n||await usable(d.accounts.bob)<95_000_000_000_000_000_000_000n)throw Error('Owned demo balances are too low; no helper or new account requested.');
 await send('Owned root funds upgrade storage',rootSigner,contract,[actions.transfer(40_000_000_000_000_000_000_000n)]);R.internalTransfersNEAR+=.04;save();
 await send('Owned bob funds upgrade storage',bob,contract,[actions.transfer(90_000_000_000_000_000_000_000n)]);R.internalTransfersNEAR+=.09;save();
 await send('Deploy v3 and migrate v2 credit state atomically',credit,contract,[actions.deployContract(wasm),actions.functionCall('migrate_market',{},80_000_000_000_000n,0n)]);
 const after={config:await view(contract,'config'),assets:await view(contract,'assets'),pool:await view(contract,'pool_status'),alice:await view(contract,'position',{borrower:d.accounts.alice}),bob:await view(contract,'position',{borrower:d.accounts.bob})};
 for(const k of['assets','pool'])if(JSON.stringify(before[k])!==JSON.stringify(after[k]))throw Error('Credit state changed across migration.');
 for(const name of['alice','bob'])for(const k of['collateral','credit_limit_usd6','pending'])if(JSON.stringify(before[name][k])!==JSON.stringify(after[name][k]))throw Error('Borrower state changed across migration.');
 if(after.config.schema_version!==3)throw Error('Migration did not finalize.');R.after=after;save();
 await send('Mint test USDC for separate stock buyer',rootSigner,d.accounts.tusdc,[actions.functionCall('mint',{account_id:d.root,amount:'500000000'},20_000_000_000_000n,0n)]);
 await send('Fund separate stock buyer (not the credit LP pool)',rootSigner,d.accounts.tusdc,[actions.functionCall('ft_transfer_call',{receiver_id:contract,amount:'500000000',msg:JSON.stringify({kind:'market'})},80_000_000_000_000n,1n)]);
 R.market=await view(contract,'market_status');if(R.market.liquidity_usd6!=='500000000')throw Error('Market funds not accepted.');R.status='PASS';
}catch{R.status='STOPPED';console.error('Upgrade stopped. Inspect the public ledger; do not repeat recorded actions.');process.exitCode=1}
finally{R.finishedAt=new Date().toISOString();save()}
