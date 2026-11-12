import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshSignedEquity} from '../equity-source.ts';
const now=1794499200000;
const asset={price_usd6:'389205000',price_at_ns:String(BigInt(now/1000-60)*1_000_000_000n),price_fresh:true,source:'relayer:https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1m&range=1d'};
test('an upstream outage preserves the original verified on-chain quote inside 90 seconds',()=>{const p=freshSignedEquity(asset,'tTSLA',now);assert.equal(p.timestampNs,asset.price_at_ns);assert.equal(p.priceUsd6,asset.price_usd6);assert.equal(p.provider,'Yahoo Finance');assert.equal(p.ageSeconds,60);assert(p.fresh);});
test('stale, future, unknown and unverified sources cannot bypass the 90-second rule',()=>{for(const extra of [{price_fresh:false},{price_at_ns:String(BigInt(now/1000-91)*1_000_000_000n)},{price_at_ns:String(BigInt(now/1000+1)*1_000_000_000n)},{source:'https://query1.finance.yahoo.com/TSLA'},{source:'relayer:https://query1.finance.yahoo.com.evil/TSLA'},{source:'relayer:malformed'},{source:'relayer:https://query1.finance.yahoo.com/v8/finance/chart/NVDA'},{price_usd6:'0'}])assert.equal(freshSignedEquity({...asset,...extra},'tTSLA',now),undefined);});
