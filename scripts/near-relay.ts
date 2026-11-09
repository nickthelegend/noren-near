// Posts one fresh relayer price (testnet): Coinbase BTC-USD spot with the exchange's trade timestamp,
// signed by the relayer key in .near-credentials/ and verified on-chain by post_signed_price.
import { accountFor, fetchBtcSpot, loadCreds, loadDeployment, send, signPrice } from "./near-lib";

const c = loadCreds(); const d = loadDeployment();
if (!c || !d) throw new Error("Setup required: run pnpm near:testnet first (no .near-credentials/testnet.json or deployments/testnet-2026-11-09.json)");
const credit = d.accounts.credit, token = "wbtc.fakes.testnet";
const spot = await fetchBtcSpot();
const { message: _m, ...args } = signPrice(c.relayerKey, credit, token, spot.priceUsd6, spot.timestampNs);
await send(d, accountFor(c.rootId, c.rootKey), "relayer posts signed BTC-USD price", credit,
  [(await import("near-api-js")).actions.functionCall("post_signed_price", args, 30_000_000_000_000n, 0n)],
  { method: "post_signed_price", note: `relayer price (testnet): Coinbase BTC-USD ${spot.raw.price} at ${spot.raw.time}` });
