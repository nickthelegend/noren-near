# Noren (暖簾)

**Keep your stocks. Spend against them.**

Noren is a credit line on NEAR testnet. Keep TEST stock tokens and BTC as collateral; a borrow pays test USDC directly to the shop's NEAR account in the same transaction.

**Current limit:** test stocks are deployed and depositable, but stock borrowing is blocked: Pyth Hermes latest-price reads return HTTP 401 without authorization. No substitute price or fresh timestamp is invented. The completed merchant-payment evidence below is BTC-backed.

**The problem.** Crypto holders who need spending money may have to sell assets they want to keep. Noren explores borrowing against those assets and sending the borrowed stablecoins straight to a merchant. The NEAR demo uses test tokens; its positions and payments are public.

## Try it

Use Node 22.22.2+ and pnpm 10.29.2. The demo runs locally. Reading needs no wallet; signing uses Meteor on **NEAR testnet**. All tokens have no value. Test stocks are **not real shares**.

1. Run `pnpm install --frozen-lockfile`, `pnpm --filter @noren/near-sdk build`, then `pnpm --filter @noren/web build` - see the production build complete. Run `pnpm --filter @noren/web exec vite preview --host 127.0.0.1 --port 5395 --strictPort` on a free port - see `http://127.0.0.1:5395/`.
2. Open that URL - see bob's live position, per-asset LTV, health and signed price age. The stock rows show tTSLA, tNVDA and tAAPL at 40% LTV; test WBTC uses 50%. An unavailable price is shown as unavailable.
3. Follow **About the NEAR edition** (`#/near`) - see “Keep your Tesla. Buy the thing.”, the explanation and recorded BTC transactions. **Open app** returns to credit. Old route bookmarks redirect to `#/near/app`.
4. Click the account chip → **Connect Meteor Wallet**, approve testnet sign-in to `credit.noren-near-mw9h22el.testnet` - see your own position. Closed/blocked wallet windows show a readable message. Human Meteor approval remains manual.
5. Open **Bring coins** (or account chip → **Deposit collateral**), choose the collateral token and amount - see your wallet balance. Deposit `1` tTSLA if your account holds it, or use **Get test WBTC (no value)** and deposit `0.0001` test WBTC - see pending → final, NearBlocks links and refreshed collateral. The three stock supplies were preissued to alice; there is no public stock mint button. The isolated QA signer can exercise alice's account by key-file path; see [TESTING.md](TESTING.md#test-stock-demo-2026-11-12).
6. Have the operator run `pnpm near:relay` for BTC and `pnpm near:stock-prices --check` for Pyth observations. `pnpm near:stock-prices` signs only fresh equity observations with their original timestamps. It currently stops at Hermes HTTP 401 before reading credentials. Quotes older than 90 seconds, including outside market hours, cannot open new credit.
7. Open **Pay anyone**, enter `0.01` test USDC and the demo shop, then **Borrow and pay shop** - with fresh prices for every held asset, see final confirmation and the shop's payment in the same transaction. With unavailable/stale stock prices, see a refresh-price error and no borrow submission. The stock-backed payment is currently blocked by the price source. Pay in 3 remains a preview.
8. Account chip → **Repay credit**; get test USDC if needed and repay the prefilled debt plus interest buffer - see final confirmation and reduced debt. Excess is refunded. Repayment needs no fresh price.
9. Account chip → **Withdraw collateral**, select the token and confirm - see final confirmation and restored wallet tokens. Withdrawals with zero debt work even when prices are unavailable; withdrawals under debt need fresh prices and must preserve LTV.
10. In **Bring coins**, click **Bring BTC / ETH / SOL / ZEC · mainnet dry quote**, choose a coin and request a quote - see the real 1Click estimate labelled **Mainnet dry quote — nothing moves on testnet**. It sends no funds and creates no testnet deposit.
11. Open **Debt-free** - see a labelled projection for BTC and an empty Harvests card. Stock positions show that no stock yield model exists. Real yield harvesting is unfinished.

See [FLOW-QA.md](FLOW-QA.md) for screenshots and exact transaction evidence. `pnpm test:e2e` runs the earlier BTC cycle; `pnpm test:e2e --stocks` also exercises mixed deposits and refuses stock borrowing without a fresh price. Production builds exclude the QA signer. Positions and payments are public. Private payments and any-chain execution remain future work for this entry.

## Live on NEAR testnet

Credit contract: [`credit.noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet). Pool token: `usdc.fakes.testnet`. BTC collateral: `wbtc.fakes.testnet`. TEST stock collateral: `ttsla.noren-near-mw9h22el.testnet`, `tnvda.noren-near-mw9h22el.testnet`, `taapl.noren-near-mw9h22el.testnet`. All have no value; test stocks are not real shares.

The Nov 12 state-preserving upgrade and three token issuances are recorded in [stock-demo-2026-11-12.json](deployments/stock-demo-2026-11-12.json). Each token has 8 decimals and 100 preissued test tokens in alice’s wallet. Stocks use 40% LTV / 50% liquidation; BTC uses 50% / 60%.

These earlier BTC hashes are copied from [the deployment record](deployments/testnet-2026-11-09.json):

| Action | Transaction |
| --- | --- |
| Deploy and initialise the credit contract | [FLyymNRKTERn8dmKg6VMfdiRUesyYPH43SznmPpQXty](https://testnet.nearblocks.io/txns/FLyymNRKTERn8dmKg6VMfdiRUesyYPH43SznmPpQXty) |
| Alice deposits 0.01 test WBTC | [FXd5ps2cY1JreqgG7SKQKdHs4Si52YQdxvGhrwK186vz](https://testnet.nearblocks.io/txns/FXd5ps2cY1JreqgG7SKQKdHs4Si52YQdxvGhrwK186vz) |
| Alice borrows 25 test USDC, paid straight to the merchant | [S66b6sCDK7eSzAgfvb8HkGU6stWiVXnsSwtY7pADS1L](https://testnet.nearblocks.io/txns/S66b6sCDK7eSzAgfvb8HkGU6stWiVXnsSwtY7pADS1L) |
| Alice repays in full; excess is refunded | [7qmisAEcVvCVEXr6Z1nGsd5YnZnpXWcsjfBFZ4Zaw7H8](https://testnet.nearblocks.io/txns/7qmisAEcVvCVEXr6Z1nGsd5YnZnpXWcsjfBFZ4Zaw7H8) |
| Alice withdraws her collateral | [7CHeCt7N6GKTniDgYMiPnkqsZf6UbjJdSoXENiJMVUcG](https://testnet.nearblocks.io/txns/7CHeCt7N6GKTniDgYMiPnkqsZf6UbjJdSoXENiJMVUcG) |

Mainnet cross-chain transfers and yield harvesting are unfinished. 1Click integration currently provides dry quotes. See [BLOCKED.md](BLOCKED.md) for the remaining work.

## NEAR HACKATHON edition

**Track:** defi (primary), realworld (secondary). **Window:** 2026-11-01 to 2026-11-14 23:59 UTC. **What is judged:** only the NEAR integration on branch `near`. Review it as one diff: [`main...near`](https://github.com/nickthelegend/noren/compare/main...near).

**What it is.** The contract `noren_credit` holds configured NEP-141 collateral and lets a borrower draw test USDC up to the sum of each asset's priced value times its LTV (stocks 40%, BTC 50%), paid straight to a merchant's NEAR account. The borrower repays, then withdraws the collateral. The SDK and saved evidence include NEAR Intents 1Click dry quotes. Bring-coins controls request mainnet dry quotes only; payments remain NEAR testnet-only. Supplying collateral to Rhea and harvesting yield to repay debt remain future work.

**What runs today, honestly.**

| Piece | Status | Evidence |
| --- | --- | --- |
| Credit contract on NEAR testnet: collateral, signed price, borrow paid to a merchant, repay, withdraw, attack rejections | **Live on NEAR testnet** | [`credit.noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet), signed transactions in [deployments/testnet-2026-11-09.json](deployments/testnet-2026-11-09.json) (table below; later demo runs append more) |
| Same contract against a real nearcore sandbox, incl. liquidation, Pay in 3, harvester path, relayer forgery/replay | **6/6 sandbox tests + 3 contract unit tests** | `packages/contract/tests/sandbox.rs`, [TESTING.md](TESTING.md#test-stock-demo-2026-11-12) |
| Price on testnet | **Relayer price (testnet)**: Coinbase BTC-USD spot, ed25519-signed, verified in the contract | `post_signed_price`; source URL and exchange timestamp are stored on-chain and shown by the `assets` view |
| NEAR Intents 1Click catalog | **Live NEAR-side catalog** in the app; mainnet sending is unfinished | Prices are planning previews. Earlier SDK dry-quote evidence is in [deployments/quotes-2026-11-09.json](deployments/quotes-2026-11-09.json); BTC/ETH/SOL/ZEC arrival estimates are explicitly dry; no mainnet execution is exposed. |
| Yield harvest that pays the debt | **BLOCKED on testnet** | No real yield source exists on testnet for this collateral (Rhea lending and Intents are mainnet-only). No yield is faked. The app shows a "debt-free on" date as a **projection** from the live position and Rhea's live WBTC supply APY |
| TEST stocks as collateral | **Issued/configured; borrowing BLOCKED by unavailable Pyth prices** | Three native NEP-141 test tokens, schema-v2 migration and 40% LTV. [Setup evidence](deployments/stock-demo-2026-11-12.json). Test tokens are not real shares or 1Click-listed issuer stock. |

**Collateral on testnet is a stand-in.** The testnet run uses `wbtc.fakes.testnet` (collateral) and `usdc.fakes.testnet` (pool), Ref Finance's public testnet NEP-141 tokens with open mint and no value. They stand in for bridged BTC (`nep141:btc.omft.near`) and NEAR USDC on mainnet. The "faucet" step in the table mints test USDC so the borrower can repay.

### Developer commands

For a production preview, run `pnpm --filter @noren/web build`, then `pnpm --filter @noren/web exec vite preview --host 127.0.0.1 --port 5395 --strictPort` on a free port. Open `http://127.0.0.1:5395/`. No merchant backend or other-chain RPC is needed. The production entry imports only NEAR screens and ships an allowlist of static assets.

- `pnpm near:verify` builds the contracts and runs the sandbox, SDK, MCP and web checks. It needs Rust 1.95.0 and cargo-near 0.22.0; its script downloads the sandbox if `NEAR_SANDBOX_BIN` is unset and no local copy is available. See [TESTING.md](TESTING.md#near-edition-2026-11-09) for the recorded results.
- `pnpm near:borrow --relay` sends a live testnet borrow with the deploy operator's credentials. It refreshes the price if older than 75 seconds, checks the positions and merchant balance, and prints the transaction links. It spends testnet NEAR and adds debt. Details: [One live borrow](#one-live-borrow-pnpm-nearborrow).
- `pnpm near:wallet-cycle --key-file .near-credentials/testnet.json` proves the browser's shared deposit/borrow/repay/withdraw pipeline with the demo key by file path, under a 0.3 testnet NEAR cap. `--dry` prints the calls without reading credentials or signing. Evidence: [wallet cycle](deployments/wallet-cycle-2026-11-11.json).
- `pnpm near:relay` posts a signed Coinbase price with the deploy operator's credentials. `pnpm near:quotes` refreshes the saved 1Click dry quotes.
- After `pnpm --filter @noren/near-sdk build` and `pnpm --filter @noren/near-mcp build`, run `pnpm --filter @noren/near-mcp start` with `NEAR_TESTNET_CONTRACT` set to the credit contract above - see `credit_status`, `quote_deposit`, `quote_spend` and `harvest_preview` exposed over MCP stdio.

### Testnet transactions (2026-11-09)

Signed by `scripts/near-testnet.ts`; root account [`noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/noren-near-mw9h22el.testnet). Contract wasm sha256 `a8436173…554cdc` (331,411 bytes).

| Step | Result | Tx |
| --- | --- | --- |
| Deploy `noren_credit` and initialise (relayer key, 10% APR, test USDC pool) | success | [FLyymNRKTE…](https://testnet.nearblocks.io/txns/FLyymNRKTERn8dmKg6VMfdiRUesyYPH43SznmPpQXty) |
| Configure test WBTC as collateral, 50% LTV (liquidation at 60%) | success | [Dy4FhKGVZ1…](https://testnet.nearblocks.io/txns/Dy4FhKGVZ14REmcNaGCDaBjoBQmXyZrhdcxSg81eBEnH) |
| LP supplies 500 test USDC to the pool (`ft_transfer_call`, kind pool) | success | [CDdrv4V1WL…](https://testnet.nearblocks.io/txns/CDdrv4V1WLmAeEQJYKSMaeoQrqejuf3xVEd8YGYKbHHJ) |
| alice deposits 0.01 test WBTC (`ft_transfer_call`, kind collateral) | success | [FXd5ps2cY1…](https://testnet.nearblocks.io/txns/FXd5ps2cY1JreqgG7SKQKdHs4Si52YQdxvGhrwK186vz) |
| Attack: a direct `ft_on_transfer` call claiming 1 WBTC | **rejected** | [3bXZ6KeZWJ…](https://testnet.nearblocks.io/txns/3bXZ6KeZWJQmMhU1SvthuQhqb99TtmhNydq16gB8LFxc) |
| Attack: borrow before any price exists | **rejected** | [8tXEoS5vmZ…](https://testnet.nearblocks.io/txns/8tXEoS5vmZUsYnKPccm8AWp6uTGYuWcfSeZ1txLBykD6) |
| Attack: a price at 10× signed by the wrong key | **rejected** | [7bBbG2bcpL…](https://testnet.nearblocks.io/txns/7bBbG2bcpLxRwkZSULV23y51Ryz1vkkR2ayd2ip48DCB) |
| Relayer price (testnet): Coinbase BTC-USD 74,829.29, signed, verified on-chain | success | [DJqNKr8ZZW…](https://testnet.nearblocks.io/txns/DJqNKr8ZZWByLjbbxfLuh88JgVBACKgWFVYvjr7ZmVax) |
| **Spend:** alice draws 25 test USDC on credit, paid straight to `shop.…` | success | [S66b6sCDK7…](https://testnet.nearblocks.io/txns/S66b6sCDK7eSzAgfvb8HkGU6stWiVXnsSwtY7pADS1L) |
| bob draws 12 test USDC to `shop.…` (left open for the app) | success | [8WL3kBN4pn…](https://testnet.nearblocks.io/txns/8WL3kBN4pnwCi88jUhgNMXoT1vHKgSYuJ8Hk23BBzha1) |
| **Harvest** | **BLOCKED** | no real testnet yield source; nothing sent |
| **Repay:** alice repays in full; NEP-141 refunds the overpayment | success | [7qmisAEcVv…](https://testnet.nearblocks.io/txns/7qmisAEcVvCVEXr6Z1nGsd5YnZnpXWcsjfBFZ4Zaw7H8) |
| **Withdraw:** alice withdraws all 0.01 test WBTC | success | [7CHeCt7N6G…](https://testnet.nearblocks.io/txns/7CHeCt7N6GKTniDgYMiPnkqsZf6UbjJdSoXENiJMVUcG) |

The JSON log also holds the account creations, storage registrations, test-token mints, a later fresh price, and one extra 1 test USDC borrow by alice ([A9KXwLQ3Zt…](https://testnet.nearblocks.io/txns/A9KXwLQ3ZtXAHt8xiku7hU2JhLrC6URm3mACJJLWQDEY)): a script re-run replayed the "borrow before any price" step after a fresh price was on-chain, so the borrow was correctly accepted. It was repaid with the rest.

### One live borrow (`pnpm near:borrow`)

`scripts/live-borrow.mjs` runs one real borrow in one command, for a demo on camera. It reads the signer from `--key-file` (default: the gitignored `.near-credentials/testnet.json`; a near-cli `{account_id, private_key}` file also works) in code and never prints it.

1. **Price check.** Reads the contract's `assets` view. If the signed BTC price is older than 75 s (the contract refuses borrows past 90 s) it stops with "run pnpm near:relay first", or with `--relay` it fetches Coinbase BTC-USD, signs it with the relayer key and sends `post_signed_price` from the borrower's account.
2. **Position before** from the `position` view: collateral, credit limit, debt, available, health.
3. **Borrow** `borrow(amount, recipient)`: the contract draws test USDC from the pool and pays it straight to the shop in the same transaction (`ft_transfer` from `credit.…` to `shop.…`). The script waits for `FINAL` and treats a `false` callback (transfer failed, debt rolled back) as a failure.
4. **Position after** plus the shop's test USDC balance before and after; it fails if the shop did not receive exactly the amount.

Options: `--account bob|alice|<id>` (default bob, the open demo loan), `--amount 1` (test USDC, at most 25), `--to <account>` (default shop), `--relay`, `--dry`. Failures print the contract's own reason (`ERR_STALE_PRICE`, `ERR_LTV`, `ERR_LIQUIDITY`, `ERR_PENDING`, …) without a stack trace. Each transaction it sends is appended to [deployments/testnet-2026-11-09.json](deployments/testnet-2026-11-09.json), so the app's activity list and transaction count include it after a reload.

First run, 2026-11-10 08:51 UTC (`pnpm near:borrow --relay`):

| Step | Result | Tx |
| --- | --- | --- |
| bob posts a fresh signed price: Coinbase BTC-USD 74,535.30 at 08:50:59 UTC | success | [3y4Awij9ix…](https://testnet.nearblocks.io/txns/3y4Awij9ixX2nMME8TeNfB7n5CqEhSarJy87yytKTp2J) |
| bob borrows 1 test USDC, paid straight to `shop.…` (debt 12.00 → 13.00, available 174.34 → 173.34, health 18.63× → 17.20×, shop 37.00 → 38.00 test USDC) | success | [FMVTHShc62…](https://testnet.nearblocks.io/txns/FMVTHShc62cZdUNBBA1tg5mWmqNWT5U67DxaPLmj33RV) |

After that first run, bob's principal was 13 test USDC (12 after the Nov 9 run). Later demo borrows add to it, and interest accrues. Read the app for the current debt.

### How the contract works

- **Collateral only through NEP-141.** `ft_on_transfer` credits the sender only when the calling token is a configured asset (`kind: collateral`), USDC for `pool`/`repay`, and the configured harvester for `yield`. A direct call cannot invent a deposit.
- **Prices.** Mainnet: `oracle_on_call` from the configured oracle contract (the Rhea / OutLayer `oracle_call` pattern). Testnet: `post_signed_price(token, price_usd6, timestamp_ns, source, signature)`; the relayer signs `sha256("noren-price:v1|contract|token|price|ts|source")` and the contract checks it with `env::ed25519_verify`, rejects prices older than 90 s, and rejects any price not newer than the stored one (no replay). Pyth Core is not called on NEAR. The stock relayer instead fetches Hermes US-equity data off-chain and uses the same signed-price entry point; the unauthenticated read is currently blocked. Source publication times are preserved, including stale last-market prices.
- **Credit.** Limit = Σ(collateral × price × LTV). Borrowing, withdrawing under debt and liquidation need a fresh price; repaying never does. Interest accrues per second at the configured APR. Health = Σ(collateral × price × liquidation threshold) ÷ debt, with the threshold 10 points above LTV.
- **Cross-contract safety.** Borrow, withdraw, LP withdraw, credit withdraw and liquidation change state, then transfer, then settle in a `#[private]` callback keyed by a per-user nonce lock; a failed transfer restores the state. Liquidation takes the liquidator's credit and the seized collateral before the transfer, so one credit balance cannot fund two concurrent liquidations.
- **Pay in 3.** `schedule_pay_in_3` stores three draws 30 days apart; anyone can execute a due one with `pay_installment`, under the same LTV and price rules.

**NEAR features used, and why.** NEP-141 transfer callbacks (authenticated deposits), `ed25519_verify` in the contract (a testnet price we can verify on-chain), promises with private callbacks (atomic-feeling transfers with rollback), sub-accounts (`credit.`, `alice.`, `bob.`, `shop.` under one root), and NEAR Intents 1Click (any chain in and out, dry quotes). Meteor manages wallet access keys. Chain Signatures, meta transactions, NEP-171/245, OutLayer TEE and Sputnik DAO are not used.

**Privacy, stated exactly.** NEAR-side collateral, debt and payments are public. Private merchant payments are part of Noren’s product vision; Confidential Intents is not integrated in this entry.

**What it would take on mainnet.** A funded `NEAR_MAINNET_ACCOUNT`; a deposit path that attributes a 1Click arrival to a borrower on-chain; a Rhea supply adapter and `harvest()` that converts earned yield to USDC through Intents; and a 1Click executor for merchant payouts and origin-chain withdrawals. See [BLOCKED.md](BLOCKED.md).

Current before/after screenshots at 1440 and 375 are linked in [FLOW-QA.md](FLOW-QA.md#near-only-entry-2026-11-11).

## Hackathon disclosures

**Event.** Built for NEAR HACKATHON 2026 (Nov 1-14). Only the NEAR integration is entered.

**Prior work.** Treat code from before Nov 1, 2026 as baseline. The available git history has no Noren commits before that date; its first commit is `5e6448e` on Nov 5, 2026 UTC. This does not establish when upstream libraries were written. The inherited Arc/Robinhood product was built Nov 5-7, before this NEAR port, and is excluded from this entry. It includes private checkout, merchant tooling, EVM credit, stock collateral, Aqua and Chainlink integrations, hosted demos and the earlier film. Its source remains on branch `main` and in git history. This branch contains only the NEAR edition and its shared visual components.

**Other editions.** Noren also has an [Avalanche edition](https://noren-avax.vercel.app/), built on Nov 12, 2026. This NEAR submission covers only the NEAR-specific code built during Nov 1-14, 2026; Avalanche work is excluded.

**Built in the window.** The Nov 9-12 NEAR work adds the Rust credit contract, signed testnet prices, NEP-141 collateral and merchant payouts, repayment and withdrawal, liquidation and Pay in 3, sandbox tests, the testnet deployment, 1Click dry quotes, the NEAR SDK/MCP tools, the NEAR pages, the live-borrow script, Meteor sign-in, browser credit actions, the NEAR-only entry, isolated QA browser signing, and native TEST stocks with a state migration, mixed-collateral risk checks, Pyth feed integration and dry Bring-coins quotes. Stock borrowing awaits an authorized or working public fresh-price source. Yield harvesting is tested as a contract input in the sandbox; a real yield adapter is unfinished.

The pre-NEAR baseline is `d91b739f84fbbf6fd72a626d183c64afbaf72c01` (Nov 7). Review locally with `git diff d91b739f84fbbf6fd72a626d183c64afbaf72c01...HEAD`, or use the [`main...near` comparison](https://github.com/nickthelegend/noren/compare/main...near) after the branch is published.

**Reused libraries.** The NEAR contract uses near-sdk and near-workspaces. The three test tokens use the immutable NEAR global FT implementation hash recorded in the setup evidence, referenced from the official [NEAR factory example](https://github.com/near-examples/factory-rust). The web app uses React, Wallet Selector and Meteor; manifests and lockfiles record the versions. [NOTICE](NOTICE) records the current third-party attributions. Dependencies and licenses for the earlier product remain on branch `main`.

**AI-assisted code.** Built with AI coding agents (Claude Code, Codex) under human direction; all code reviewed and tested by the team.

**Art.** 3D art generated with ChatGPT (the indigo-lacquer objects in the NEAR pages; kit and placements in [docs/ART-3D.md](docs/ART-3D.md)).

**Other projects by the same team in this hackathon:**

Lead: &lt;TBD by Nick&gt;

**License.** MIT for Noren-authored code; see [LICENSE](LICENSE) and the third-party notices above.

## Why the name Noren (暖簾)

A noren is the split curtain at a shop doorway. It is the image behind Noren's private merchant-payment vision. This NEAR demo focuses on credit against test stocks and BTC; its positions and payments are public.

## License

Noren-authored code is [MIT](LICENSE). Third-party code retains the licenses recorded in [NOTICE](NOTICE) and the package directories.
