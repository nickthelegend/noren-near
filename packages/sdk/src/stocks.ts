// US-equity feeds, not the separate 24/7 synthetic index feeds. Verified against Hermes metadata.
export const STOCK_FEEDS = [
  { symbol: 'tTSLA', ticker: 'TSLA', name: 'TEST Tesla — not real shares', feedId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1' },
  { symbol: 'tNVDA', ticker: 'NVDA', name: 'TEST NVIDIA — not real shares', feedId: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593' },
  { symbol: 'tAAPL', ticker: 'AAPL', name: 'TEST Apple — not real shares', feedId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688' },
] as const;
export const HERMES_URL = 'https://pyth.dourolabs.app/hermes';
export const YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
export const stockAccount = (symbol: string, root: string) => {
  if (!STOCK_FEEDS.some(x => x.symbol === symbol) || !root.endsWith('.testnet')) throw Error('Test stock account requires the testnet namespace.');
  return `${symbol.toLowerCase()}.${root}`;
};
export type StockPrice = { symbol: string; feedId: string; priceUsd6: string; timestampNs: string; publishTime: number; ageSeconds: number; fresh: boolean; source: string; confidence?: string; exponent?: number; provider: 'Pyth Hermes' | 'Yahoo Finance'; marketOpen?: boolean };
export function decodeStockPrices(parsed: unknown, now = Date.now()): StockPrice[] {
  if (!Array.isArray(parsed)) throw Error('Pyth omitted parsed prices.');
  return STOCK_FEEDS.map(feed => {
    const value = parsed.find(x => x?.id === feed.feedId)?.price;
    if (!value || !/^[0-9]+$/.test(value.price) || !Number.isInteger(value.expo) || value.expo < -18 || value.expo > 6 || !Number.isSafeInteger(value.publish_time) || value.publish_time <= 0) throw Error(`Pyth omitted a valid ${feed.ticker} quote.`);
    const scale = value.expo + 6, raw = BigInt(value.price), price = scale >= 0 ? raw * 10n ** BigInt(scale) : raw / 10n ** BigInt(-scale);
    if (price <= 0n || value.publish_time * 1000 > now + 5000) throw Error('Pyth quote is invalid or from the future.');
    const age = Math.max(0, Math.floor(now / 1000) - value.publish_time);
    return { symbol: feed.symbol, feedId: feed.feedId, priceUsd6: price.toString(), timestampNs: (BigInt(value.publish_time) * 1_000_000_000n).toString(), publishTime: value.publish_time, ageSeconds: age, fresh: age <= 90, source: `${HERMES_URL}/v2/updates/price/latest?ids[]=${feed.feedId}`, confidence: String(value.conf), exponent: value.expo, provider: 'Pyth Hermes' };
  });
}
export function decodeYahooPrice(body: unknown, symbol: string, now = Date.now()): StockPrice {
  const feed = STOCK_FEEDS.find(x => x.symbol === symbol);
  const meta = (body as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart?.result?.[0]?.meta;
  const value = meta?.regularMarketPrice, time = meta?.regularMarketTime;
  if (!feed || meta?.symbol !== feed.ticker || meta.currency !== 'USD' || typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || typeof time !== 'number' || !Number.isSafeInteger(time) || time <= 0 || time * 1000 > now + 5000) throw Error('Yahoo returned an invalid USD equity quote or publication time.');
  const price = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(price) || price <= 0) throw Error('Yahoo equity price is outside the supported range.');
  const period = (meta.currentTradingPeriod as { regular?: { start?: number; end?: number } })?.regular;
  if (!period || !Number.isSafeInteger(period.start) || !Number.isSafeInteger(period.end) || period.start! >= period.end!) throw Error('Yahoo omitted regular market hours.');
  const marketOpen = now / 1000 >= period.start! && now / 1000 < period.end!;
  const ageSeconds = Math.max(0, Math.floor(now / 1000) - time);
  return { symbol, feedId: feed.feedId, priceUsd6: String(price), timestampNs: (BigInt(time) * 1_000_000_000n).toString(), publishTime: time, ageSeconds, fresh: marketOpen && ageSeconds <= 90, marketOpen, provider: 'Yahoo Finance', source: `${YAHOO_URL}/${feed.ticker}?interval=1m&range=1d` };
}
export type StockPriceOptions = { pythApiKey?: string; symbols?: string[] };
export async function stockPrices(fetcher: typeof fetch = fetch, options: StockPriceOptions = {}): Promise<StockPrice[]> {
  const feeds = STOCK_FEEDS.filter(f => !options.symbols || options.symbols.includes(f.symbol));
  if (!feeds.length) throw Error('Choose a configured test stock.');
  const get = async (url: string, headers: Record<string, string>, name: string) => {
    let response: Response;
    try { response = await fetcher(url, { headers, signal: AbortSignal.timeout(15000) }); }
    catch { throw Error(`${name} could not be reached. Last signed prices remain visible; borrowing requires fresh prices.`); }
    if (response.status === 401 || response.status === 403) throw Error(`${name} requires valid authorization (HTTP 401/403). No price or timestamp is substituted.`);
    if (response.status === 429) throw Error(`${name} rate-limited the request (HTTP 429). Stop and retry later.`);
    if (!response.ok) throw Error(`${name} price read failed (HTTP ${response.status}).`);
    try { return await response.json(); } catch { throw Error(`${name} returned unreadable price data.`); }
  };
  if (options.pythApiKey) {
    const url = new URL(`${HERMES_URL}/v2/updates/price/latest`);
    // Decoder verifies all configured feed IDs. The secret is a header, never part of a URL or result.
    STOCK_FEEDS.forEach(feed => url.searchParams.append('ids[]', feed.feedId));
    const data = await get(url.toString(), { authorization: `Bearer ${options.pythApiKey}` }, 'Pyth Hermes');
    return decodeStockPrices(data.parsed).filter(p => feeds.some(f => f.symbol === p.symbol));
  }
  const prices: StockPrice[] = [];
  for (const feed of feeds) {
    const url = `${YAHOO_URL}/${feed.ticker}?interval=1m&range=1d`;
    const data = await get(url, { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }, 'Yahoo Finance');
    prices.push(decodeYahooPrice(data, feed.symbol));
  }
  return prices;
}
