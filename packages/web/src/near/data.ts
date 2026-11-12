// Live data for Noren's NEAR edition. Every number on screen comes from one of three live sources
// (the NEAR testnet contract, the 1Click token catalog, Rhea's rate endpoint) or from the recorded
// testnet transaction log, which links each step to the explorer.
import { useCallback, useEffect, useState } from "react";
import { nearView, rheaRates, supportedTokens, STOCK_FEEDS, stockAccount, stockPrices, type Rate, type Token } from "@noren/near-sdk";
import record from "../../../../deployments/testnet-2026-11-09.json";

export type Step = { step: string; account: string; method?: string; hash: string; status: "success" | "rejected"; explorer: string; note?: string };
export const RECORD = record as unknown as { root: string; updatedAt: string; accounts: Record<string, string>; contracts: Record<string, { account: string; wasmSha256: string; bytes: number }>; steps: Step[]; blocked: { step: string; reason: string }[]; relayerPublicKey: string };


export const CONTRACT = (import.meta.env.VITE_NEAR_TESTNET_CONTRACT as string | undefined) || RECORD.accounts.credit;
export const COLLATERAL = RECORD.accounts.tbtc; // wbtc.fakes.testnet: public testnet WBTC standing in for bridged BTC
export const COLLATERALS = [
  { token: COLLATERAL, symbol: 'test WBTC', ticker: 'BTC', decimals: 8, stock: false },
  ...STOCK_FEEDS.map(x => ({ token: stockAccount(x.symbol, RECORD.root), symbol: x.symbol, ticker: x.ticker, decimals: 8, stock: true })),
];
export const collateralMeta = (token: string) => COLLATERALS.find(x => x.token === token) ?? COLLATERALS[0];
export const DEMO = { open: RECORD.accounts.bob, repaid: RECORD.accounts.alice, merchant: RECORD.accounts.shop };
export const NEAR_USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const explorerAccount = (id: string) => `https://testnet.nearblocks.io/address/${id}`;

export type AssetView = { token: string; decimals: number; ltv_bps: number; liq_bps: number; price_usd6: string; price_at_ns: string; price_fresh: boolean; source: string };
export type Position = { borrower: string; collateral: { token: string; amount: string; value_usd6: string }[]; collateral_usd6: string; credit_limit_usd6: string; debt_usd6: string; available_usd6: string; health_bps: string | null; prices_fresh: boolean; pending: boolean; apr_bps: number };
export type Pool = { liquidity: bigint; supplied: bigint; utilizationBps: number; aprBps: number };

export type Load<T> = { data?: T; error?: string; loading: boolean; at?: number };
function useLive<T>(fn: () => Promise<T>, deps: unknown[], everyMs = 0): Load<T> & { reload: () => void } {
  const key = JSON.stringify(deps);
  const [s, set] = useState<Load<T> & { key: string }>({ loading: true, key });
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    let alive = true;
    set((p) => ({ ...(p.key === key ? p : {}), key, loading: true }));
    fn().then((data) => alive && set({ data, loading: false, at: Date.now(), key }))
      .catch((e) => alive && set({ error: e instanceof Error ? e.message : String(e), loading: false, key }));
    const t = everyMs ? setInterval(reload, everyMs) : undefined;
    return () => { alive = false; if (t) clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  // A new account must never render the previous account's position while its request is pending.
  return { ...(s.key === key ? s : { loading: true }), reload };
}

export const useAssets = () => useLive(() => nearView<AssetView[]>(CONTRACT, "assets", {}), [], 30_000);
export const usePool = () => useLive(async (): Promise<Pool> => {
  const [[liq, sup], util, apr] = await Promise.all([
    nearView<[string, string]>(CONTRACT, "pool_status", {}), nearView<number>(CONTRACT, "utilization_bps", {}), nearView<number>(CONTRACT, "borrow_apr_bps", {}),
  ]);
  return { liquidity: BigInt(liq), supplied: BigInt(sup), utilizationBps: util, aprBps: apr };
}, [], 30_000);
export const usePosition = (account: string) => useLive(() => nearView<Position>(CONTRACT, "position", { borrower: account }), [account], 30_000);
export const useTokens = () => useLive<Token[]>(async () => (await supportedTokens()).filter((token) => token.blockchain === "near"), []);
export const useStockPrices = () => useLive(() => stockPrices(), []);
export const useRates = () => useLive<Rate[]>(() => rheaRates(), []);

// ------------------------------------------------------------------ formatting
export const usd6 = (raw: string | bigint | undefined, digits = 2) => raw === undefined ? "—"
  : (Number(BigInt(raw)) / 1e6).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
export const units = (raw: string, decimals: number, max = 6) => (Number(BigInt(raw)) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: max });
export const short = (id: string) => id.length > 24 ? `${id.slice(0, 10)}…${id.slice(-12)}` : id;
export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;
export function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`; return `${Math.round(s / 86_400)} d ago`;
}
export const nsToMs = (ns: string) => Number(BigInt(ns) / 1_000_000n);
export const healthLabel = (bps: string | null) => bps === null ? "No debt" : `${(Number(bps) / 1e4).toFixed(2)}×`;

/** NEAR-side representations in the live catalog; configured TEST stock tokens and test WBTC are collateral. */
export const HOME_COINS = [
  { symbol: "BTC", chain: "near", name: "Bitcoin", rhea: "nbtc.bridge.near" },
  { symbol: "ZEC", chain: "near", name: "Zcash", rhea: "zec.omft.near" },
  { symbol: "ETH", chain: "near", name: "Ether", rhea: "eth.bridge.near" },
  { symbol: "wNEAR", chain: "near", name: "Wrapped NEAR", rhea: "wrap.near" },
] as const;
export const STOCK_RE = /^x?(NVDA|AAPL|TSLA|MSFT|AMZN|GOOGL|GOOG|SPY|META|QQQ)x?$/i;

/** Debt over time if collateral earns `supplyApy` and the debt accrues `aprBps`, with yield harvested into the debt
 *  monthly. Returns monthly points and the payoff date, or null when the yield never outruns the interest. */
export function meltCurve(debtUsd: number, collateralUsd: number, supplyApyPct: number, aprBps: number) {
  if (debtUsd <= 0) return { points: [{ t: Date.now(), debt: 0 }], payoff: new Date() };
  const yearlyYield = collateralUsd * supplyApyPct / 100, apr = aprBps / 10_000;
  const points: { t: number; debt: number }[] = []; let debt = debtUsd; const now = Date.now(); const month = 365.25 / 12 * 86_400_000;
  for (let m = 0; m <= 600; m++) {
    points.push({ t: now + m * month, debt: Math.max(0, debt) });
    if (debt <= 0) return { points, payoff: new Date(now + m * month) };
    debt = debt * (1 + apr / 12) - yearlyYield / 12;
    if (m > 24 && debt >= points[0].debt) return { points, payoff: null };
  }
  return { points, payoff: null };
}
