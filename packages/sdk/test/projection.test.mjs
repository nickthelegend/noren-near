import test from "node:test";
import assert from "node:assert/strict";
import { debtFreeProjection, supportedStockTokens } from "../dist/index.js";

test("positive net yield yields a future projection", () => {
  const projected = debtFreeProjection(1_000_000n, 100_000_000n, 8, 100_000_000n, 5, 1);
  assert.ok(projected instanceof Date);
  assert.ok(projected.getTime() > Date.now());
});
test("interest exceeding yield has no debt-free date", () => {
  assert.equal(debtFreeProjection(1_000_000n, 100_000_000n, 8, 1_000_000n, 1, 20), null);
});
test("zero debt is debt-free now", () => {
  assert.ok(Math.abs(debtFreeProjection(0n, 0n, 8, 0n, 0, 0).getTime() - Date.now()) < 1000);
});
test("tokenised stock detection does not infer stocks from a blockchain name", () => {
  const sample = [{ symbol: "ETH", blockchain: "hood", assetId: "eth", decimals: 18 },
    { symbol: "xBTC", blockchain: "sol", assetId: "xbtc", decimals: 8 },
    { symbol: "NVDA", blockchain: "sol", assetId: "nvda", decimals: 6 }];
  assert.deepEqual(supportedStockTokens(sample).map(t => t.symbol), ["NVDA"]);
});
