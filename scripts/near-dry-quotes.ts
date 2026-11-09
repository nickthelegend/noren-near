// Public read-only probes. The recipient is the documented intents.near account; no funds are sent.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dryQuote, supportedTokens } from "../packages/sdk/src/index.js";

const tokens = await supportedTokens();
const required = [
  "nep141:btc.omft.near", "nep141:nbtc.bridge.near",
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
];
for (const id of required) if (!tokens.some(t => t.assetId === id)) throw new Error(`Not listed: ${id}`);
const pairs = [
  { label: "BTC to NEAR NBTC Intents balance", originAsset: required[0], destinationAsset: required[1], amount: "10000" },
  { label: "NEAR USDC to Base USDC Intents balance", originAsset: required[2], destinationAsset: required[3], amount: "1000000" },
];
const quotes = [];
for (const pair of pairs) {
  const response = await dryQuote({ originAsset: pair.originAsset, destinationAsset: pair.destinationAsset, amount: pair.amount,
    recipient: "intents.near", recipientType: "INTENTS", refundTo: "intents.near", refundType: "INTENTS" });
  quotes.push({ label: pair.label, requestedAt: response.timestamp, dry: true, probeRecipient: "intents.near",
    quote: response.quote });
}
const file = resolve(import.meta.dirname, "../deployments/quotes-2026-11-09.json");
mkdirSync(resolve(import.meta.dirname, "../deployments"), { recursive: true });
writeFileSync(file, JSON.stringify({ source: "https://1click.chaindefuser.com/v0/quote", observedAt: new Date().toISOString(), tokenCount: tokens.length,
  note: "Read-only probes to a public account; not borrower deposits or merchant payments", quotes }, null, 2) + "\n");
console.log(`Saved ${quotes.length} real dry quotes from a ${tokens.length}-token live catalog`);
