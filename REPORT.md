# Noren on NEAR: build report (2026-11-09)

## What is live

- **NEAR testnet.** `noren_credit` is deployed at [`credit.noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet). One full cycle ran with signed transactions: an LP supplies test USDC, alice deposits test WBTC, a Coinbase BTC-USD price signed by Noren's relayer is verified on-chain, alice draws 25 USDC paid straight to a merchant, repays in full and withdraws her collateral. bob's 12 USDC loan is left open so the app has a live position. Three attacks were rejected on-chain (a forged deposit callback, a borrow with no price, a price signed by the wrong key). All 28 hashes are in `deployments/testnet-2026-11-09.json` and the README.
- **Sandbox.** 5/5 tests on a real nearcore sandbox cover the lifecycle, liquidation, Pay in 3, the harvester path and relayer forgery, tampering, staleness and replay.
- **1Click.** 5 timestamped `dry: true` mainnet quotes, and live quotes from the app's Pay tab.
- **App.** `#/near` (landing) and `#/near/app` (credit app) in Noren's own design system, reading the testnet contract, the 1Click catalog and Rhea's rates live. Checked in headless Chrome at 1440 and 390 px.
- **MCP.** `credit_status`, `quote_deposit`, `quote_spend` and `harvest_preview` over stdio; the live test reads the testnet contract.

## Fixes made in this pass (over the Codex build)

- Prices: a testnet relayer path (`post_signed_price`, ed25519 verified in the contract, freshness and anti-replay) beside the mainnet oracle path.
- Liquidation: credit, collateral and debt now move before the transfer and are restored on failure, so a liquidator's credit cannot fund two concurrent liquidations (the old callback could underflow after the collateral had left). Liquidation starts 10 points above LTV, so a max-LTV borrower is not liquidatable one second later. Unused liquidation credit can be withdrawn.
- A `position` view that never panics on a stale price, plus `assets`, `config` and `installments_of`.
- The Codex NEAR page (its own dark green palette and Urbanist/Space Mono on a landing) was replaced with pages built from Noren's components and styles.

## Blocked

Harvest on testnet (no real yield source); mainnet deposits, merchant payouts and origin-chain withdrawals (Setup required: NEAR_MAINNET_ACCOUNT); browser wallet signing (not built); tokenised stocks (none in the catalog). Details and exact unblockers: `BLOCKED.md`.

## Commands

```sh
pnpm near:verify                       # sandbox, SDK, MCP (live), web build, Chrome gate, vitest
pnpm near:testnet                      # deploy + lifecycle (spends testnet NEAR), hashes saved
pnpm near:relay                        # post one fresh signed Coinbase price
pnpm near:quotes                       # 1Click dry: true quotes
pnpm --filter @noren/web dev           # http://localhost:5190/#/near and #/near/app
```
