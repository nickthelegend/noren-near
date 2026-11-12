# Noren on NEAR: build report (Nov 9, updated Nov 12 2026)

## What is live

The original deployment counts and balances below describe the Nov 9 run. Browser signing and the repository scope were updated afterward. Later demo borrows append transactions to the deployment log and change bob's debt; read the app for the current position.

- **NEAR testnet.** `noren_credit` is deployed at [`credit.noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet). One full cycle ran with signed transactions: an LP supplies test USDC, alice deposits test WBTC, a Coinbase BTC-USD price signed by Noren's relayer is verified on-chain, alice draws 25 USDC paid straight to a merchant, repays in full and withdraws her collateral. bob's 12 USDC loan is left open so the app has a live position. Three attacks were rejected on-chain (a forged deposit callback, a borrow with no price, a price signed by the wrong key). The original run has 28 recorded steps in `deployments/testnet-2026-11-09.json`; selected transactions are linked in the README.
- **Tests (Nov 12).** Six tests on a real nearcore sandbox plus 3 contract unit tests cover the lifecycle, liquidation, Pay in 3, the harvester path and relayer forgery, tampering, staleness and replay.
- **1Click.** Five timestamped `dry: true` quotes remain as SDK evidence. The current web app shows the NEAR-side catalog and exposes only NEAR testnet payment destinations; it does not execute mainnet routes.
- **App.** `/` opens `#/near/app`; `#/near` explains the NEAR edition. The approved indigo components read NEAR testnet positions, the NEAR-side 1Click catalog and Rhea rates. Inherited routes redirect to the NEAR app.
- **MCP.** `credit_status`, `quote_deposit`, `quote_spend` and `harvest_preview` over stdio; the live test reads the testnet contract.

The Nov 12 upgrade preserves v1 state and adds schema version 2. TEST tTSLA/tNVDA/tAAPL are configured at 40% LTV / 50% liquidation; BTC remains 50% / 60%. Mixed-collateral, stale-price, forgery, over-borrow and liquidation checks pass. See [stock setup](deployments/stock-demo-2026-11-12.json). Yahoo Finance is now the no-key equity source; an authorized Pyth key is optional. A native tTSLA-only cycle paid 25 test USDC to the shop and restored the stock after repayment. Mixed stock/BTC browser cycles at 1440 and 375 also paid 25 each; fresh signed prices, original publication times and FINAL receipts were checked. See the latest section of [FLOW-QA.md](FLOW-QA.md#yahoo-stock-payment-completion-2026-11-12).

## Browser signing and repository scope

Meteor testnet sign-in and browser deposit, borrow/pay, repay and withdraw are built. The gated QA signer completed real browser-signed cycles at 1440 and 375, with pending/final receipts and on-chain position checks: [qa-browser-2026-11-11.json](deployments/qa-browser-2026-11-11.json). Human Meteor approval remains a separate manual check. QA signing is excluded from ordinary production builds.

The `near` tree now retains only the NEAR contract, SDK, MCP server, web app and shared visual assets. Earlier product code and its test history remain on branch `main`; films and sealed NEAR evidence were not changed. Current verification is recorded in [TESTING.md](TESTING.md) and [FLOW-QA.md](FLOW-QA.md).

## Fixes made in this pass (over the Codex build)

- Prices: a testnet relayer path (`post_signed_price`, ed25519 verified in the contract, freshness and anti-replay) beside the mainnet oracle path.
- Liquidation: credit, collateral and debt now move before the transfer and are restored on failure, so a liquidator's credit cannot fund two concurrent liquidations (the old callback could underflow after the collateral had left). Liquidation starts 10 points above LTV, so a max-LTV borrower is not liquidatable one second later. Unused liquidation credit can be withdrawn.
- A `position` view that never panics on a stale price, plus `assets`, `config` and `installments_of`.
- The Codex NEAR page (its own dark green palette and Urbanist/Space Mono on a landing) was replaced with pages built from Noren's components and styles.

## Blocked

Harvest on testnet (no real yield source); mainnet deposits, merchant payouts and origin-chain withdrawals (Setup required: NEAR_MAINNET_ACCOUNT); new equity borrowing outside fresh regular-market quotes. Unauthenticated Pyth still returns HTTP 401, but Yahoo Finance removes that blocker for the testnet stock demo. Details and exact unblockers: `BLOCKED.md`.

## Commands

```sh
pnpm near:verify                       # sandbox, SDK, MCP (read-only live), web build, NEAR Chrome gate, web tests
pnpm near:testnet                      # deploy + lifecycle (spends testnet NEAR), hashes saved
pnpm near:relay                        # post one fresh signed Coinbase price
pnpm near:quotes                       # 1Click dry: true quotes
pnpm --filter @noren/web dev           # http://localhost:5190/#/near and #/near/app
```
