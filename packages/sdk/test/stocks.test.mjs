import test from 'node:test';
import assert from 'node:assert/strict';
import { STOCK_FEEDS, decodeStockPrices, stockPrices, stockAccount } from '../dist/index.js';
const now=1800000000000;
const prices=()=>STOCK_FEEDS.map(feed=>({id:feed.feedId,price:{price:'12345678900',expo:-8,conf:'123',publish_time:now/1000-10}}));
test('US equity feed IDs, exact decimal scaling and original exchange timestamps',()=>{const p=decodeStockPrices(prices(),now);assert.equal(p[0].priceUsd6,'123456789');assert.equal(p[0].timestampNs,String(BigInt(now/1000-10)*1000000000n));assert(p.every(x=>x.fresh&&x.ageSeconds===10));assert.equal(stockAccount('tTSLA','demo.testnet'),'ttsla.demo.testnet');assert.throws(()=>stockAccount('tTSLA','demo.near'));});
test('closed-market quotes remain old and stale; missing/future/negative prices are refused',()=>{const old=prices().map(p=>({...p,price:{...p.price,publish_time:now/1000-10000}}));assert(decodeStockPrices(old,now).every(x=>!x.fresh&&x.ageSeconds===10000));for(const field of [{price:'-1'},{publish_time:now/1000+100},{expo:-30}]){const p=prices();Object.assign(p[0].price,field);assert.throws(()=>decodeStockPrices(p,now));}assert.throws(()=>decodeStockPrices([],now));});
test('Hermes authorization and rate limits are explicit failures, never fake prices',async()=>{await assert.rejects(stockPrices(async()=>new Response('',{status:401})),/requires authorization/);await assert.rejects(stockPrices(async()=>new Response('',{status:429})),/Stop and retry later/);});
