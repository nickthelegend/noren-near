// US-equity feeds, not the separate 24/7 synthetic index feeds. Verified against Hermes metadata.
export const STOCK_FEEDS = [
  { symbol: 'tTSLA', ticker: 'TSLA', name: 'TEST Tesla — not real shares', feedId: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1' },
  { symbol: 'tNVDA', ticker: 'NVDA', name: 'TEST NVIDIA — not real shares', feedId: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593' },
  { symbol: 'tAAPL', ticker: 'AAPL', name: 'TEST Apple — not real shares', feedId: '49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688' },
] as const;
export const HERMES_URL = 'https://hermes.pyth.network';
export const stockAccount = (symbol: string, root: string) => {
  if (!STOCK_FEEDS.some(x => x.symbol === symbol) || !root.endsWith('.testnet')) throw Error('Test stock account requires the testnet namespace.');
  return `${symbol.toLowerCase()}.${root}`;
};
export type StockPrice = { symbol: string; feedId: string; priceUsd6: string; timestampNs: string; publishTime: number; ageSeconds: number; fresh: boolean; source: string; confidence: string; exponent: number };
export function decodeStockPrices(parsed: unknown, now = Date.now()): StockPrice[] {
  if (!Array.isArray(parsed)) throw Error('Pyth omitted parsed prices.');
  return STOCK_FEEDS.map(feed => {
    const value = parsed.find(x => x?.id === feed.feedId)?.price;
    if (!value || !/^[0-9]+$/.test(value.price) || !Number.isInteger(value.expo) || value.expo < -18 || value.expo > 6 || !Number.isSafeInteger(value.publish_time) || value.publish_time <= 0) throw Error(`Pyth omitted a valid ${feed.ticker} quote.`);
    const scale = value.expo + 6, raw = BigInt(value.price), price = scale >= 0 ? raw * 10n ** BigInt(scale) : raw / 10n ** BigInt(-scale);
    if (price <= 0n || value.publish_time * 1000 > now + 5000) throw Error('Pyth quote is invalid or from the future.');
    const age = Math.max(0, Math.floor(now / 1000) - value.publish_time);
    return { symbol: feed.symbol, feedId: feed.feedId, priceUsd6: price.toString(), timestampNs: (BigInt(value.publish_time) * 1_000_000_000n).toString(), publishTime: value.publish_time, ageSeconds: age, fresh: age <= 90, source: `${HERMES_URL}/v2/updates/price/latest?ids[]=${feed.feedId}`, confidence: String(value.conf), exponent: value.expo };
  });
}
export async function stockPrices(fetcher: typeof fetch = fetch): Promise<StockPrice[]> {
  const url = new URL('/v2/updates/price/latest', HERMES_URL);
  STOCK_FEEDS.forEach(feed => url.searchParams.append('ids[]', feed.feedId));
  let response: Response;
  try { response = await fetcher(url.toString(), { signal: AbortSignal.timeout(15000) }); } catch { throw Error('Pyth Hermes could not be reached. Last signed prices remain visible; borrowing requires fresh prices.'); }
  if (response.status === 401 || response.status === 403) throw Error('Pyth Hermes requires authorization (HTTP 401/403). No public stock price is available; no timestamp or price is substituted.');
  if (response.status === 429) throw Error('Pyth Hermes rate-limited the request (HTTP 429). Stop and retry later.');
  if (!response.ok) throw Error(`Pyth Hermes price read failed (HTTP ${response.status}).`);
  return decodeStockPrices((await response.json()).parsed);
}
