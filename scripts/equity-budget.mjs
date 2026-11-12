// Shared public evidence budget for this continuation; never reads a credential file.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const EQUITY_BUDGET_GROUP='equity-source-2026-11-12';
export const EQUITY_CAP=500_000_000_000_000_000_000_000n;
export function equityBudgetUsed(){
 const dir=resolve(import.meta.dirname,'../deployments');let total=0n;
 for(const file of readdirSync(dir).filter(f=>/^(stock-payment-|qa-browser-equities-).*\.json$/.test(f))){const d=JSON.parse(readFileSync(resolve(dir,file),'utf8'));for(const r of d.runs??[d])if(r.budgetGroup===EQUITY_BUDGET_GROUP)total+=BigInt(['PASS','BLOCKED_PRICE_SOURCE'].includes(r.status)&&r.budgetChargedYocto!==undefined?r.budgetChargedYocto:r.reservedYocto??'0');}
 return total;
}
export function assertEquityBudget(additional){if(equityBudgetUsed()+additional>EQUITY_CAP)throw Error('Equity continuation budget of 0.5 testnet NEAR would be exceeded.');}
