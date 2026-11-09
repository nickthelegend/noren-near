import { debtFreeProjection, nearView, quoteDeposit as oneClickDeposit, quoteSpend as oneClickSpend, rheaRates, supportedTokens } from "@noren/near-sdk";

function contract(): string {
  const id = process.env.NEAR_TESTNET_CONTRACT;
  if (!id) throw new Error("Setup required: NEAR_TESTNET_CONTRACT");
  return id;
}
export async function creditStatus(account: string) {
  const id = contract();
  const [debt, creditLimit, healthBps, pool] = await Promise.all([
    nearView<string>(id, "debt", { borrower: account }),
    nearView<string>(id, "credit_limit", { borrower: account }),
    nearView<string>(id, "health_bps", { borrower: account }),
    nearView<[string, string]>(id, "pool_status", {}),
  ]);
  return { account, contract: id, debtUsd6: debt, creditLimitUsd6: creditLimit, healthBps, pool, network: "testnet" };
}
export async function quoteDeposit(input: { originAsset: string; destinationAsset: string; amount: string; nearAccount: string; originRefund: string }) {
  return oneClickDeposit(input.originAsset, input.destinationAsset, input.amount, input.nearAccount, input.originRefund, process.env.ONECLICK_JWT);
}
export async function quoteSpend(input: { originAsset: string; destinationAsset: string; amount: string; merchant: string; borrower: string; confidential?: boolean }) {
  return oneClickSpend(input.originAsset, input.destinationAsset, input.amount, input.merchant, input.borrower, process.env.ONECLICK_JWT, input.confidential);
}
export async function harvestPreview(input: { account: string; token: string }) {
  const id = contract();
  const [debt, collateral, aprBps, rates, tokens] = await Promise.all([
    nearView<string>(id, "debt", { borrower: input.account }),
    nearView<string>(id, "collateral_of", { borrower: input.account, token: input.token }),
    nearView<number>(id, "borrow_apr_bps", {}),
    rheaRates(), supportedTokens(),
  ]);
  const rate = rates.find(x => x.token === input.token);
  const listed = tokens.find(x => x.contractAddress === input.token && x.blockchain === "near");
  if (!rate || !listed || !listed.price || !listed.priceUpdatedAt) throw new Error("Setup required: live Rhea rate and listed NEAR token price");
  if (Date.now() - Date.parse(listed.priceUpdatedAt) > 90_000) throw new Error("Stale 1Click display price");
  const date = debtFreeProjection(BigInt(debt), BigInt(collateral), listed.decimals, BigInt(Math.round(listed.price * 1e6)), Number(rate.supply_apy), aprBps / 100);
  return { account: input.account, token: input.token, debtUsd6: debt, collateralRaw: collateral, supplyApyPercent: rate.supply_apy,
    projectedDebtFreeOn: date?.toISOString() ?? null, label: "Projection only. Noren has not supplied this collateral to Rhea.", observedAt: new Date().toISOString() };
}
