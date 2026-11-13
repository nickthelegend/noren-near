/** A browser-local index of final receipts; the explorer is the source of chain evidence. */
export type Activity={hash:string;action:string;at:number};
const key=(account:string)=>'noren.near.receipts.'+account;
export function readActivity(account:string):Activity[]{try{const rows=JSON.parse(localStorage.getItem(key(account))??'[]');return Array.isArray(rows)?rows:[]}catch{return[]}}
export function recordActivity(account:string,rows:Activity[]){const next=[...rows,...readActivity(account)].filter((r,i,all)=>all.findIndex(a=>a.hash===r.hash)===i).slice(0,40);try{localStorage.setItem(key(account),JSON.stringify(next))}catch{/* A blocked storage policy must not turn a final payment into an error. */}return next}
