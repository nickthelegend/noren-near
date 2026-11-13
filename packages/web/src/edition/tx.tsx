import {short} from './api';
export function TxLink({hash,n=6}:{hash?:string;n?:number;chain?:string;cfg?:unknown}){return hash?<a href={`https://testnet.nearblocks.io/txns/${encodeURIComponent(hash)}`} target="_blank" rel="noreferrer" className="mono">{short(hash,n)} ↗</a>:<span>—</span>}
