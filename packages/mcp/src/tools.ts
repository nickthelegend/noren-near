import { debtFreeProjection, nearView, quoteDeposit as oneClickDeposit, quoteSpend as oneClickSpend, rheaRates } from "@noren/near-sdk";

function contract(): string {
  const id = process.env.NEAR_TESTNET_CONTRACT;
  if (!id) throw new Error("Setup required: NEAR_TESTNET_CONTRACT");
  return id;
}
type Position = { borrower: string; collateral: { token: string; amount: string; value_usd6: string }[]; collateral_usd6: string;
  credit_limit_usd6: string; debt_usd6: string; available_usd6: string; health_bps: string | null; prices_fresh: boolean; pending: boolean; apr_bps: number };
/** One read of the contract's position view, plus the pool. Never signs anything. */
export async function creditStatus(account: string) {
  const id = contract();
  const [position, pool] = await Promise.all([
    nearView<Position>(id, "position", { borrower: account }),
    nearView<[string, string]>(id, "pool_status", {}),
  ]);
  return { network: "testnet", contract: id, ...position, pool: { liquidityUsd6: pool[0], suppliedUsd6: pool[1] },
    note: "USD amounts have 6 decimals. Collateral value uses the relayer price (testnet) stored on the contract." };
}
export async function quoteDeposit(input: { originAsset: string; destinationAsset: string; amount: string; nearAccount: string; originRefund: string }) {
  return oneClickDeposit(input.originAsset, input.destinationAsset, input.amount, input.nearAccount, input.originRefund, process.env.ONECLICK_JWT);
}
export async function quoteSpend(input: { originAsset: string; destinationAsset: string; amount: string; merchant: string; borrower: string; confidential?: boolean }) {
  return oneClickSpend(input.originAsset, input.destinationAsset, input.amount, input.merchant, input.borrower, process.env.ONECLICK_JWT, input.confidential);
}
const WBTC_RHEA = "2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near";
/** Projects a debt-free date from the live position and a live Rhea supply APY (default: Rhea's WBTC market,
 *  the mainnet home of the BTC collateral the testnet token stands in for). A projection, never a harvest. */
export async function harvestPreview(input: { account: string; rheaToken?: string }) {
  const id = contract();
  const [position, rates] = await Promise.all([nearView<Position>(id, "position", { borrower: input.account }), rheaRates()]);
  const token = input.rheaToken ?? WBTC_RHEA;
  const rate = rates.find(x => x.token === token);
  if (!rate) throw new Error(`Rhea lists no market for ${token}`);
  const date = debtFreeProjection(BigInt(position.debt_usd6), BigInt(position.collateral_usd6), 6, 1_000_000n, Number(rate.supply_apy), position.apr_bps / 100);
  return { account: input.account, debtUsd6: position.debt_usd6, collateralUsd6: position.collateral_usd6, rheaToken: token,
    supplyApyPercent: rate.supply_apy, borrowAprPercent: position.apr_bps / 100, projectedDebtFreeOn: date?.toISOString() ?? null,
    label: "Projection only. No harvest has run: Rhea and Intents are mainnet-only (Setup required: NEAR_MAINNET_ACCOUNT).",
    observedAt: new Date().toISOString() };
}
