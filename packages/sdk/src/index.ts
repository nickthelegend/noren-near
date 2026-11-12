export const NEAR_TESTNET_RPC = "https://test.rpc.fastnear.com";
export const ONECLICK_URL = "https://1click.chaindefuser.com";
export const RHEA_RATES_URL = "https://api.burrow.finance/list_token_data";

export type Token = { assetId: string; decimals: number; blockchain: string; symbol: string; price?: number; priceUpdatedAt?: string; contractAddress?: string };
export type QuoteRequest = {
  originAsset: string; destinationAsset: string; amount: string; recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS"; refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS"; depositType?: "ORIGIN_CHAIN" | "INTENTS";
  confidentiality?: "basic" | "advanced";
};
export type QuoteResponse = { quote: unknown; timestamp: string };
export type Rate = { symbol: string; token: string; supply_apy: string; borrow_apy: string };

async function jsonResponse(response: Response): Promise<unknown> {
  const raw = await response.text();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`The service returned an unreadable response (HTTP ${response.status}). Try again.`); }
  if (!response.ok) {
    const body = parsed as { message?: unknown; error?: unknown } | null;
    const detail = body?.message ?? body?.error;
    throw new Error(typeof detail === "string" ? `${detail.replace(/\s+/g, " ").slice(0, 180)} (HTTP ${response.status}). Try again.` : `The service is unavailable (HTTP ${response.status}). Try again.`);
  }
  return parsed;
}
async function fetchResponse(url: string, init: RequestInit, fetcher: typeof fetch): Promise<Response> {
  try { return await fetcher(url, { ...init, signal: AbortSignal.timeout(15_000) }); }
  catch { throw new Error("The service could not be reached. Check your connection and try again."); }
}
export async function supportedTokens(fetcher: typeof fetch = fetch): Promise<Token[]> {
  const result = await jsonResponse(await fetchResponse(`${ONECLICK_URL}/v0/tokens`, {}, fetcher));
  if (!Array.isArray(result)) throw new Error("1Click token response is not an array");
  return result as Token[];
}
export function supportedStockTokens(tokens: Token[]): Token[] {
  return tokens.filter(t => /^x?(NVDA|AAPL|TSLA|MSFT|AMZN|GOOGL|GOOG|SPY|META)$/i.test(t.symbol));
}
export async function dryQuote(request: QuoteRequest, jwt?: string, fetcher: typeof fetch = fetch): Promise<QuoteResponse> {
  if (!/^\d+$/.test(request.amount) || BigInt(request.amount) <= 0n) throw new Error("Amount must be positive raw units");
  const tokens = await supportedTokens(fetcher);
  if (!tokens.some(t => t.assetId === request.originAsset)) throw new Error("Origin asset is not in live 1Click list");
  if (!tokens.some(t => t.assetId === request.destinationAsset)) throw new Error("Destination asset is not in live 1Click list");
  const body = {
    dry: true, swapType: "EXACT_INPUT", slippageTolerance: 100,
    originAsset: request.originAsset, depositType: request.depositType ?? "ORIGIN_CHAIN",
    destinationAsset: request.destinationAsset, amount: request.amount,
    recipient: request.recipient, recipientType: request.recipientType,
    refundTo: request.refundTo, refundType: request.refundType,
    deadline: new Date(Date.now() + 180_000).toISOString(),
    ...(request.confidentiality ? { confidentiality: request.confidentiality } : {}),
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  const quote = await jsonResponse(await fetchResponse(`${ONECLICK_URL}/v0/quote`, { method: "POST", headers, body: JSON.stringify(body) }, fetcher));
  return { quote, timestamp: new Date().toISOString() };
}
export async function quoteDeposit(originAsset: string, destinationAsset: string, amount: string, nearAccount: string, originRefund: string, jwt?: string): Promise<QuoteResponse> {
  if (!/^[a-z0-9._-]+$/.test(nearAccount)) throw new Error("A named NEAR account is required for attributable collateral");
  return dryQuote({ originAsset, destinationAsset, amount, recipient: nearAccount, recipientType: "INTENTS", refundTo: originRefund, refundType: "ORIGIN_CHAIN" }, jwt);
}
export async function quoteSpend(originAsset: string, destinationAsset: string, amount: string, merchant: string, borrower: string, jwt?: string, confidential = false): Promise<QuoteResponse> {
  return dryQuote({ originAsset, destinationAsset, amount, recipient: merchant, recipientType: "DESTINATION_CHAIN",
    refundTo: borrower, refundType: "ORIGIN_CHAIN", confidentiality: confidential ? "basic" : undefined }, jwt);
}
export async function rheaRates(fetcher: typeof fetch = fetch): Promise<Rate[]> {
  const result = await jsonResponse(await fetchResponse(RHEA_RATES_URL, {}, fetcher)) as { code?: string; data?: Rate[] };
  if (result.code !== "0" || !Array.isArray(result.data)) throw new Error("Rhea rates unavailable");
  return result.data;
}
export function debtFreeProjection(debtUsd6: bigint, collateralRaw: bigint, decimals: number, priceUsd6: bigint, supplyApyPercent: number, borrowAprPercent: number): Date | null {
  if (debtUsd6 <= 0n) return new Date();
  if (!Number.isFinite(supplyApyPercent) || !Number.isFinite(borrowAprPercent) || decimals < 0 || decimals > 24) return null;
  const collateralUsd = Number(collateralRaw * priceUsd6 / 10n ** BigInt(decimals)) / 1e6;
  const debtUsd = Number(debtUsd6) / 1e6;
  const netAnnual = collateralUsd * supplyApyPercent / 100 - debtUsd * borrowAprPercent / 100;
  if (netAnnual <= 0) return null;
  const years = debtUsd / netAnnual;
  if (!Number.isFinite(years) || years > 100) return null;
  return new Date(Date.now() + years * 365.25 * 86_400_000);
}
export async function nearView<T>(contractId: string, method: string, args: object, rpc = NEAR_TESTNET_RPC, fetcher: typeof fetch = fetch): Promise<T> {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  const base64 = btoa(String.fromCharCode(...bytes));
  const payload = { jsonrpc: "2.0", id: "noren", method: "query", params: { request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: base64 } };
  const response = await jsonResponse(await fetchResponse(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }, fetcher)) as { error?: { data?: { cause?: { name?: string } } }; result?: { result?: number[]; error?: unknown } };
  if (response.error?.data?.cause?.name === "UNKNOWN_ACCOUNT") throw new Error("The NEAR account could not be found. Check the account and try again.");
  if (response.error || response.result?.error) throw new Error("The NEAR contract could not be read. Try again shortly.");
  if (!response.result?.result) throw new Error("NEAR RPC omitted call result");
  return JSON.parse(new TextDecoder().decode(new Uint8Array(response.result.result))) as T;
}

export * from "./stocks.js";
