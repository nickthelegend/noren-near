// Node-only selection. Never expose PYTH_API_KEY to Vite, the browser, URLs or logs.
import { stockPrices, STOCK_FEEDS } from '../packages/sdk/src/stocks.ts';
export const equityPrices = (symbols?: string[]) => stockPrices(fetch, { pythApiKey: process.env.PYTH_API_KEY, symbols });

// An unavailable upstream does not invalidate an already verified, unexpired on-chain quote.
export function freshSignedEquity(asset: { price_usd6: string; price_at_ns: string; price_fresh: boolean; source: string } | undefined, symbol = 'tTSLA', now = Date.now()) {
  try {
    if (!asset?.price_fresh || !asset.source.startsWith('relayer:')) return undefined;
    const feed=STOCK_FEEDS.find(f=>f.symbol===symbol);if(!feed)return undefined;
    const source=asset.source.slice('relayer:'.length),url=new URL(source),host=url.hostname;
    if(host==='query1.finance.yahoo.com'){if(url.pathname!==`/v8/finance/chart/${feed.ticker}`)return undefined;}
    else if(!['pyth.dourolabs.app','hermes.pyth.network'].includes(host)||!url.searchParams.getAll('ids[]').includes(feed.feedId))return undefined;
    const publishTime=Number(BigInt(asset.price_at_ns)/1_000_000_000n),ageSeconds=Math.floor(now/1000)-publishTime;
    if(ageSeconds<0||ageSeconds>90||BigInt(asset.price_usd6)<=0n)return undefined;
    return {symbol,feedId:feed.feedId,priceUsd6:asset.price_usd6,timestampNs:asset.price_at_ns,publishTime,ageSeconds,fresh:true,source,provider:host.includes('yahoo')?'Yahoo Finance' as const:'Pyth Hermes' as const};
  }catch{return undefined;}
}
