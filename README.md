# Noren (暖簾)

**Keep your stocks. Spend against them.**

Noren brings merchant checkout and stock-backed credit to NEAR testnet. Keep TEST stock tokens and BTC as collateral; a borrow pays test USDC directly to the shop's named NEAR account. Direct stock payment is a separate sale into test USDC. Payments are public; private checkout is not integrated.

**Live demo:** 1 TEST tTSLA was kept as collateral while the contract paid 25 test USDC directly to the shop. Repayment and withdrawal restored the stock balance. Yahoo Finance is the no-key quote source; an authorized `PYTH_API_KEY` selects Pyth instead. Prices retain their publication time and expire after 90 seconds.

**The problem.** Crypto holders who need spending money may have to sell assets they want to keep. Noren explores borrowing against those assets and sending the borrowed stablecoins straight to a merchant. The NEAR demo uses test tokens; its positions and payments are public.

## Try it

Use Node 22.22.2+ and pnpm 10.29.2. Run locally; nothing has been newly hosted. Use Meteor on **NEAR testnet** to sign. Test tokens have no cash value; TEST stocks are **not real shares**.

1. Run `pnpm install --frozen-lockfile`, then `pnpm build:near` - see the SDK, typecheck and production web build complete. Run `pnpm --filter @noren/web exec vite preview --host 127.0.0.1 --port 5395 --strictPort` on a free port - see the local web app and merchant API at `http://127.0.0.1:5395/`.
2. Open `/` - see Noren's original landing, the product explanation and its public-payment limits. **Read the API** scrolls to the real HTTP integration example. **Noren Merchant** opens `#/dashboard`.
3. In Merchant, sign with Meteor, name the business, choose a named `.testnet` payout account and create a payment link - see the local store record, checkout URL and one-time API secret. Store metadata is off-chain; the service verifies the wallet signature. Developers lets you create and revoke keys. Webhooks and refunds are labelled unavailable.
4. In Merchant Settings, **Connect Aubelle demo shop**, then open `/shop/` - see the original demo boutique. Choose a dress and size, add it to your bag and **Checkout with Noren** - see the hosted-checkout screen. No goods are shipped. USDC sends public test dollars; stock payment sells TEST stock to a separate test-USDC buyer. Private payment is explicitly unavailable.
5. Open **Noren app** (`#/app`). Connect Meteor - see your actual test-token balances and six tabs: Home, Pay, Earn, Credit, Borrow and Swap. In **Earn**, choose tTSLA and deposit `1`; choose test WBTC and deposit `0.0001` if held - see pending → FINAL, explorer links and your mixed position. Demo stock tokens were preissued to alice; new stock issuance needs the issuer. The wallet menu has a public test-USDC faucet. These collateral deposits earn no yield.
6. Have the operator run `pnpm near:relay` for BTC and `pnpm near:stock-prices --check --symbol=tTSLA` for an equity observation. `pnpm near:stock-prices --symbol=tTSLA` posts only a fresh, newer publication. Yahoo Finance is the no-key source; `PYTH_API_KEY` selects authenticated Pyth in Node. Original publication time is preserved. Outside regular US trading, or after 90 seconds, stock borrowing and sales pause. Rate limits stop the request; no price or timestamp is invented.
7. In **Borrow**, enter `25` test USDC and a shop's `.testnet` account, then **Borrow and pay shop** - with fresh prices and enough credit, see FINAL execution and the shop paid while your stock stays deposited. For an invoice receipt, paste the merchant's link in **Pay** and choose credit. **Pay in 3** schedules three draws; scheduling alone pays nothing. Only a completed due draw pays its part, with later draws due after 30 and 60 days. No automatic keeper runs.
8. In **Credit**, **Repay credit** - see debt cleared; excess interest buffer is refunded. In **Earn**, select each asset and withdraw the deposited amount - see the same collateral return. Repayment and debt-free withdrawals need no fresh quote. **Swap** instead sells selected TEST stock for test USDC; it does not preserve that stock.
9. Return to Merchant Payments and Balances - see verified invoice-bound receipts, actual amounts received and public payer accounts. A partial installment stays partial. A customer can return from checkout to the Aubelle order receipt.
10. Wallet menu or Swap → **Bring BTC / ETH / SOL / ZEC** - see a real Intents **mainnet dry quote — nothing moves on testnet**. Real ZEC funding needs mainnet execution and a tested attribution adapter; it is not shown as a deposit. The preserved credit reader remains at `#/near/app`, and its explanation at `#/near`.

See [FLOW-QA.md](FLOW-QA.md) for the executed route checks and exact transaction evidence. [TESTING.md](TESTING.md) explains the isolated QA signer and live browser runners. Production builds exclude it. Positions and payments are public. Private checkout, mainnet execution, stock yield and automatic installments remain unfinished.

## Live on NEAR testnet

Credit contract: [`credit.noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet). Pool token: `usdc.fakes.testnet`. BTC collateral: `wbtc.fakes.testnet`. TEST stock collateral: `ttsla.noren-near-mw9h22el.testnet`, `tnvda.noren-near-mw9h22el.testnet`, `taapl.noren-near-mw9h22el.testnet`. All have no value; test stocks are not real shares.

The Nov 12 state-preserving upgrade and three token issuances are recorded in [stock-demo-2026-11-12.json](deployments/stock-demo-2026-11-12.json). Each token has 8 decimals and 100 preissued test tokens in alice’s wallet. Stocks use 40% LTV / 50% liquidation; BTC uses 50% / 60%.

The native stock-only cycle is recorded in [stock-payment-2026-11-12T15-48-19-050Z.json](deployments/stock-payment-2026-11-12T15-48-19-050Z.json). The quote was $389.345 per TEST tTSLA with the original Yahoo publication time; after borrowing 25 test USDC, health was 7.7869×. Test tokens are not real shares.

| Action | Transaction |
| --- | --- |
| Post Yahoo Finance tTSLA quote, signed by Noren’s relayer | [BfmjrfTvabaffvUNnwA7hFCfwcHTd7Vs3YkVsm1deLnn](https://testnet.nearblocks.io/txns/BfmjrfTvabaffvUNnwA7hFCfwcHTd7Vs3YkVsm1deLnn) |
| Deposit 1 TEST tTSLA | [GkoZCBkXUyv33fEFAftv5ptPgdTKBmYq6Y6nEWqskdHY](https://testnet.nearblocks.io/txns/GkoZCBkXUyv33fEFAftv5ptPgdTKBmYq6Y6nEWqskdHY) |
| Borrow 25 test USDC directly to the shop | [CBaApGYvBD8JgPDJhsEjNrbD1ZWTVRoU8L4EM8JCriyd](https://testnet.nearblocks.io/txns/CBaApGYvBD8JgPDJhsEjNrbD1ZWTVRoU8L4EM8JCriyd) |
| Repay stock-backed debt | [38dfNdoGxwgycbbnB1PUFwDkx9zZTZNhBDn7M3BUF5Kr](https://testnet.nearblocks.io/txns/38dfNdoGxwgycbbnB1PUFwDkx9zZTZNhBDn7M3BUF5Kr) |
| Withdraw the same 1 TEST tTSLA | [3wKXRsrWL984N2M35YhUXL87LZL7pm3XbZskiw9Dp96k](https://testnet.nearblocks.io/txns/3wKXRsrWL984N2M35YhUXL87LZL7pm3XbZskiw9Dp96k) |

The browser also completed the mixed tTSLA/BTC payment, repayment and withdrawal at 1440 and 375. Exact receipts, health and before/after screenshots: [FLOW-QA.md](FLOW-QA.md#yahoo-stock-payment-completion-2026-11-12).

The restored app also completed a Nov 13 BTC-backed credit and installment cycle: [25 test USDC to the shop](https://testnet.nearblocks.io/txns/BGDHPES1sJDFDxYWRcwhVKBZk8h8gtMb3K13a1L3we5S), then [49.333333 to Aubelle as its first installment](https://testnet.nearblocks.io/txns/CuVRseXe1WMtpjVwrkjisKRen3CtchHpcydPukDs9vFz). Repayment cleared the debt and the same BTC returned. The order correctly remains partly paid; future draws are unpaid. [Evidence](deployments/ethglobal-credit-browser-2026-11-13T08-53-51-393Z.json).

Mainnet cross-chain transfers and yield harvesting are unfinished. 1Click integration currently provides dry quotes. See [BLOCKED.md](BLOCKED.md) for the remaining work.

## NEAR HACKATHON edition

**Track:** defi (primary), realworld (secondary). **Window:** 2026-11-01 to 2026-11-14 23:59 UTC. **What is judged:** only the NEAR integration on branch `near`. Review it locally with `git diff main...near`; this branch has not been pushed.

**What it is.** The contract `noren_credit` holds configured NEP-141 collateral and lets a borrower draw test USDC up to the sum of each asset's priced value times its LTV (stocks 40%, BTC 50%), paid straight to a merchant's NEAR account. The borrower repays, then withdraws the collateral. The SDK and saved evidence include NEAR Intents 1Click dry quotes. Bring-coins controls request mainnet dry quotes only; payments remain NEAR testnet-only. Supplying collateral to Rhea and harvesting yield to repay debt remain future work.

**What runs today, honestly.**

| Piece | Status | Evidence |
| --- | --- | --- |
| Credit contract on NEAR testnet: collateral, signed price, borrow paid to a merchant, repay, withdraw, attack rejections | **Live on NEAR testnet** | [`credit.noren-near-mw9h22el.testnet`](https://testnet.nearblocks.io/address/credit.noren-near-mw9h22el.testnet), signed transactions in [deployments/testnet-2026-11-09.json](deployments/testnet-2026-11-09.json) (table below; later demo runs append more) |
| Same contract against a real nearcore sandbox, incl. liquidation, Pay in 3, harvester path, relayer forgery/replay | **7/7 sandbox tests + 4 contract unit tests** | `packages/contract/tests/sandbox.rs`, [TESTING.md](TESTING.md#test-stock-demo-2026-11-12) |
| Price on testnet | **Relayer price (testnet)**: Coinbase BTC-USD spot, ed25519-signed, verified in the contract | `post_signed_price`; source URL and exchange timestamp are stored on-chain and shown by the `assets` view |
| NEAR Intents 1Click catalog | **Live NEAR-side catalog** in the app; mainnet sending is unfinished | Prices are planning previews. Earlier SDK dry-quote evidence is in [deployments/quotes-2026-11-09.json](deployments/quotes-2026-11-09.json); BTC/ETH/SOL/ZEC arrival estimates are explicitly dry; no mainnet execution is exposed. |
| Yield harvest that pays the debt | **BLOCKED on testnet** | No real yield source exists on testnet for this collateral (Rhea lending and Intents are mainnet-only). No yield is faked. The app shows a "debt-free on" date as a **projection** from the live position and Rhea's live WBTC supply APY |
| TEST stocks as collateral | **Live TEST tTSLA credit payments** | Three native NEP-141 test tokens, state-preserving migrations (current schema v3) and 40% LTV. The tTSLA payment uses a Yahoo quote signed by Noren’s relayer; other stocks need their own fresh posts. [Setup evidence](deployments/stock-demo-2026-11-12.json). Test tokens are not real shares or 1Click-listed issuer stock. |

**Collateral on testnet is a stand-in.** The testnet run uses `wbtc.fakes.testnet` (collateral) and `usdc.fakes.testnet` (pool), Ref Finance's public testnet NEP-141 tokens with open mint and no value. They stand in for bridged BTC (`nep141:btc.omft.near`) and NEAR USDC on mainnet. The "faucet" step in the table mints test USDC so the borrower can repay.

### Developer commands

For a production preview, run `pnpm --filter @noren/web build`, then `pnpm --filter @noren/web exec vite preview --host 127.0.0.1 --port 5395 --strictPort` on a free port. Open `http://127.0.0.1:5395/`. Vite serves the local merchant API on the same port. It persists service metadata under the ignored `.near-data/` directory; it never reads wallet keys. No other-chain RPC is used. Static hosting needs an approved persistent API host, a build-time `VITE_NOREN_API`, exact `NOREN_WEB_ORIGIN`, and durable `NOREN_DATA_FILE`; hosting remains subject to Nick’s approval. `vercel.json` supplies static SPA rewrites.

- `pnpm near:verify` builds the contracts and runs the sandbox, SDK, MCP and web checks. It needs Rust 1.95.0 and cargo-near 0.22.0; its script downloads the sandbox if `NEAR_SANDBOX_BIN` is unset and no local copy is available. See [TESTING.md](TESTING.md#near-edition-2026-11-09) for the recorded results.
- `pnpm near:borrow --relay` sends a live testnet borrow with the deploy operator's credentials. It refreshes the price if older than 75 seconds, checks the positions and merchant balance, and prints the transaction links. It spends testnet NEAR and adds debt. Details: [One live borrow](#one-live-borrow-pnpm-nearborrow).
- `pnpm near:wallet-cycle --key-file .near-credentials/testnet.json` proves the browser's shared deposit/borrow/repay/withdraw pipeline with the demo key by file path, under a 0.3 testnet NEAR cap. `--dry` prints the calls without reading credentials or signing. Evidence: [wallet cycle](deployments/wallet-cycle-2026-11-11.json).
- `pnpm near:stock-payment` runs a real stock-only deposit → 25 test USDC shop payment → repay → withdraw cycle with the existing demo credential file, a unique deployment ledger and the shared 0.5 NEAR continuation budget. It requires fresh prices and a funded, debt-free demo account.
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

- **Collateral only through NEP-141.** `ft_on_transfer` credits the sender only when the calling token is a configured asset (`kind: collateral`), USDC for `pool`/`repay`/owner-only `market`, and the configured harvester for `yield`. A direct call cannot invent a deposit.
- **Prices.** Mainnet: `oracle_on_call` from the configured oracle contract (the Rhea / OutLayer `oracle_call` pattern). Testnet: `post_signed_price(token, price_usd6, timestamp_ns, source, signature)`; the relayer signs `sha256("noren-price:v1|contract|token|price|ts|source")` and the contract checks it with `env::ed25519_verify`, rejects prices older than 90 s, and rejects any price not newer than the stored one (no replay). Pyth Core is not called on NEAR. The stock relayer fetches Yahoo Finance chart metadata without a key, or authenticated Pyth Hermes when `PYTH_API_KEY` is set, then uses the same signed-price entry point. The contract verifies Noren’s signature; it does not verify a Yahoo attestation or a Pyth proof. Source publication times are preserved, including stale last-market prices.
- **Credit.** Limit = Σ(collateral × price × LTV). Borrowing, withdrawing under debt and liquidation need a fresh price; repaying never does. Interest accrues per second at the configured APR. Health = Σ(collateral × price × liquidation threshold) ÷ debt, with the threshold 10 points above LTV.
- **Cross-contract safety.** Borrow, withdraw, LP withdraw, credit withdraw and liquidation change state, then transfer, then settle in a `#[private]` callback keyed by a per-user nonce lock; a failed transfer restores the state. Liquidation takes the liquidator's credit and the seized collateral before the transfer, so one credit balance cannot fund two concurrent liquidations.
- **Pay in 3.** `schedule_pay_in_3` stores three draws 30 days apart; anyone can execute a due one with `pay_installment`, under the same LTV and price rules.

**NEAR features used, and why.** NEP-141 transfer callbacks (authenticated deposits), `ed25519_verify` in the contract (a testnet price we can verify on-chain), promises with private callbacks (atomic-feeling transfers with rollback), sub-accounts (`credit.`, `alice.`, `bob.`, `shop.` under one root), and NEAR Intents 1Click (any chain in and out, dry quotes). Meteor manages wallet access keys. Chain Signatures, meta transactions, NEP-171/245, OutLayer TEE and Sputnik DAO are not used.

**Privacy, stated exactly.** NEAR-side collateral, debt and payments are public. Private merchant payments are part of Noren’s product vision; Confidential Intents is not integrated in this entry.

**What it would take on mainnet.** A funded `NEAR_MAINNET_ACCOUNT`; a deposit path that attributes a 1Click arrival to a borrower on-chain; a Rhea supply adapter and `harvest()` that converts earned yield to USDC through Intents; and a 1Click executor for merchant payouts and origin-chain withdrawals. See [BLOCKED.md](BLOCKED.md).

Current before/after screenshots at 1440 and 375 are linked in [FLOW-QA.md](FLOW-QA.md#near-only-entry-2026-11-11).

## Hackathon disclosures

**Event.** Built for NEAR HACKATHON 2026 (Nov 1-14). Only the NEAR integration is entered.

**Prior work.** Noren at ETHGlobal (Arc), Nov 2026; this is the NEAR edition.

**Inherited baseline.** Treat code from before Nov 1, 2026 as baseline. The available git history has no Noren commits before that date; its first commit is `5e6448e` on Nov 5, 2026 UTC. This does not establish when upstream libraries were written. The inherited Arc/Robinhood product was built Nov 5-7, before this NEAR port, and is excluded from this entry. It includes private checkout, merchant tooling, EVM credit, stock collateral, Aqua and Chainlink integrations, hosted demos and the earlier film. Its source remains on branch `main` and in git history. This branch contains only the NEAR edition and its shared visual components.

**Other editions.** Noren also has an [Avalanche edition](https://noren-avax.vercel.app/), built on Nov 12, 2026. This NEAR submission covers only the NEAR-specific code built during Nov 1-14, 2026; Avalanche work is excluded.

**Built in the window.** The Nov 9-13 NEAR work adds the Rust credit contract, signed testnet prices, NEP-141 collateral and merchant payouts, repayment and withdrawal, liquidation and Pay in 3, sandbox tests, the testnet deployment, 1Click dry quotes, the NEAR SDK/MCP tools, the NEAR pages, the live-borrow script, Meteor sign-in, browser credit actions, the NEAR-only entry, isolated QA browser signing, and native TEST stocks with a state migration, mixed-collateral risk checks, Pyth feed integration and dry Bring-coins quotes. Yahoo-priced stock credit payments and browser cycles are now recorded on testnet; authenticated Pyth remains optional. The Nov 13 port restores the original merchant, Aubelle and six-tab app surfaces with native NEAR signing, verified HTTP merchant receipts, and an isolated TEST-stock buyer funded separately from credit LPs. Yield harvesting is tested as a contract input in the sandbox; a real yield adapter is unfinished.

The pre-NEAR baseline is `d91b739f84fbbf6fd72a626d183c64afbaf72c01` (Nov 7). Review locally with `git diff d91b739f84fbbf6fd72a626d183c64afbaf72c01...HEAD`, publish a public comparison only after Nick approves pushing the branch.

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
