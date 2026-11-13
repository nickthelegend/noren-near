# Test results

## Gasless checkout, NEP-366 (2026-11-13)

**40 vitest tests passed** (web + merchant; was 24): 16 new for the gas relayer — 7 policy (allowlist, invoice binding, gas/deposit caps, expiry, testnet-only, per-shopper and global daily caps, in-flight lock), signature rebuild against edits and other keys, the `/api/relay` route (stale nonce, function-call key, missing test USDC, Setup required, failed relay not counted as paid), relayed-receipt verification and refusal of a Delegate receipt the relayer didn't submit or whose inner transfer failed, plus the browser wire format verified byte for byte by the relayer. These unit tests touch no chain. Web typecheck passed. The Rust contract, sandbox, SDK, equity-source and MCP code are unchanged and were not rerun (their 27 results stand below).

Live on NEAR testnet: `pnpm near:gasless` (PASS: outer signer = relayer, inner sender = shopper, shopper NEAR 0 → 0, exact USDC moved, merchant receipt verified, plus two refusals that spent no gas: a field edited after signing and a second payment for a paid link) and the browser film run through the hosted checkout (PASS). Both in [README](README.md#gasless-checkout-pay-in-usdc-with-0-near-nep-366-meta-transactions). Checkout screenshots before/after at 1440 and 375 (no overflow) are in the orchestration shots folder's `noren-near/gasless/`.

```sh
pnpm near:gasless:setup   # once: relayer account + zero-balance shopper (already done)
pnpm near:gasless         # one live relayed payment through the real service code
```

## ETHGlobal surface port on NEAR (2026-11-13)

**51 executed tests passed:** 4 Rust unit, 7 real local NEAR sandbox, 12 SDK, 2 equity-source, 2 live read-only MCP, 24 web/merchant. Frozen install, web typecheck and production build passed. Production excludes the QA module and both injection markers even with `VITE_QA_SIGNER=1`. The production text audit found no whole-word Arc, Robinhood, CCTP, CCIP or NYSE content.

The restored merchant/shop/app pass captured 78 screens at 1440/375 without unhandled page exceptions or horizontal overflow. It verified actual NEP-413 signatures, onboarding through one-time API keys, key revocation, all merchant tabs, the six app tabs, Aubelle bag-to-checkout, and empty/invalid states. Real 1-test-USDC payments finalized at each width and appeared in verified merchant receipts. [Evidence](deployments/ethglobal-browser-2026-11-13T07-03-34-762Z.json). Native WBTC sale and receipt recovery passed at both widths. The restored app also completed a real BTC-backed 25-test-USDC shop payment, the first 49.333333-test-USDC Aubelle installment, repayment and withdrawal. New TEST-stock sale and stock-backed filming await the market opening; sandbox receipts are not filmed testnet receipts.

To run the edition browser check, first build the isolated QA edition, then run one preview on a free port:

```sh
VITE_QA_SIGNER=1 pnpm --filter @noren/web exec vite build --mode qa --outDir ../../.near-build/ethglobal-qa --emptyOutDir
pnpm --filter @noren/web exec vite preview --host 127.0.0.1 --port 5395 --strictPort --outDir ../../.near-build/ethglobal-qa
# In another shell; uses that same preview, no second server:
pnpm test:edition
# Also signs one real 1-test-USDC invoice payment per width (0.1 NEAR cap):
pnpm test:edition --live-usdc
# Native WBTC sale, including receipt-network failure and same-hash recovery:
pnpm test:edition --live-crypto --verify-retry
# One real unpaid schedule; checks no merchant payment and no unfunded draw:
pnpm test:edition --live-schedule --verify-retry
# Full BTC-backed app/Aubelle credit cycle (only from a clean funded position):
pnpm test:credit-edition
```

The runner uses shared `withChromeLock`, reads the existing demo credential file only in Node, injects only into an ephemeral loopback QA page, keeps credentials out of screenshots/logs and records every payment hash in `deployments/ethglobal-browser-*.json`. API secrets are masked. It starts no server; stop the preview you started when done. A normal production build uses Meteor and cannot load the QA signer. Live quote reads and all native writes are testnet-only. The old `pnpm test:e2e` runner now opens the preserved `#/near/app` path.

Standalone merchant API for a future approved host: `pnpm near:merchant`. Set `PORT`, `NOREN_WEB_ORIGIN` to the exact approved web origin and `NOREN_DATA_FILE` to durable storage. Never run it alongside another local preview during this constrained QA. No wallet key belongs on this service. Local Vite already embeds the same service on its one port.

Screenshots were captured locally during QA and are not committed. Before/after sets use `before-*`, `edition-*` and `after-*` under the orchestration shots folder's `noren-near/ethglobal-port/` directory.

### Native checkout and installment follow-up

The WBTC buyer flow and receipt-network interruption/reload passed at 1440/375 with 88 captures and no second payment. [Evidence](deployments/ethglobal-browser-2026-11-13T07-59-17-568Z.json). The first earlier sale had paid on-chain but exposed legacy test-USDC log handling; its original failed record and [same-hash recovery](deployments/ethglobal-receipt-recovery-2026-11-13.json) remain intact.

A real three-draw schedule paid nothing and refused an unfunded first draw. [Schedule evidence](deployments/ethglobal-browser-2026-11-13T08-28-36-398Z.json). The restored app then completed a BTC-backed cycle: deposit 0.003 test WBTC, fresh relayer price, shop payment 25, Aubelle schedule 148, first draw 49.333333, repay all debt and withdraw the same BTC. The merchant gained exactly 74.333333 test USDC; health was 1.6644× and final debt/collateral were zero. Eight transactions, including the public test-token faucet, cost 0.0040072647773523 testnet NEAR. [Sealed record](deployments/ethglobal-credit-browser-2026-11-13T08-53-51-393Z.json).

That record honestly retains `CHAIN_PASS_UI_FIX_REQUIRED`: its real partial order exposed incorrect awaiting-payment copy. The service now returns actual paid amounts; Aubelle shows 49.33 received / 98.67 due and keeps polling. Checkout resumes the existing schedule and offers the order-status link. A read-only follow-up passed four captures at 1440/375 with no new transaction: [partial-order evidence](deployments/ethglobal-partial-order-ui-2026-11-13.json). Future installments are not yet due; no early cancellation, settlement switch or automatic keeper is implemented. The 24 web/merchant tests include public order totals and partial-payment projection.

## Yahoo stock payment continuation (2026-11-12)

**Stock-backed credit is live on NEAR testnet.** The native script deposited 1 TEST tTSLA, borrowed 25 test USDC directly to the shop, showed health 7.7869×, repaid and withdrew the same token. Mixed stock/BTC browser cycles also paid 25 at 1440 and 375 with real signatures, FINAL receipts and restored zero-debt positions. Test stocks are not real shares. Exact hashes and the final combined run are in [FLOW-QA.md](FLOW-QA.md#yahoo-stock-payment-completion-2026-11-12).

**Executed in this continuation: 24 automated tests passed** — 12 SDK, 10 web and 2 Node source-reuse regression tests. SDK and production web typecheck/build passed; production excludes the QA signer even with its flag set. No contract code or Wasm changed: the earlier Nov 12 result of 3 contract unit + 6 sandbox tests, and 2 MCP tests, remains dated evidence below; these 11 tests were not rerun for the quote-source change.

```sh
pnpm --filter @noren/near-sdk build
pnpm --filter @noren/near-sdk test
pnpm test
pnpm test:equity-source
pnpm --filter @noren/web build
# Public read; --symbol avoids requesting unrelated equities:
pnpm near:stock-prices --check --symbol=tTSLA
# Operator signing, original publication time, only newer prices:
pnpm near:stock-prices --symbol=tTSLA
# Real stock-only cycle using the existing demo credential file:
pnpm near:stock-payment
# Real mixed-collateral browser cycles:
pnpm test:e2e --stocks
# Focused retry at one width; same budgets and evidence:
pnpm test:e2e --stocks --width=375
```

The native stock cycle seeds public fake USDC if repayment balances are low, posts the source-signed price, deposits tTSLA and pays the shop 25 test USDC through the browser's shared `runCreditAction` pipeline. The e2e runner uses 1 tTSLA plus 0.0001 test WBTC, pays 25, repays 25.01 (excess refunded), withdraws both and checks wallet balances, exact merchant gain, healthy debt and no remaining debt/collateral. The live stock-held Debt-free view says “No stock yield model”. Low NEAR or repayment-token balances stop the run; a final combined preflight correctly stopped with no transaction until fake USDC was replenished.

**Final combined run: PASS at 1440 and 375**, `pnpm test:e2e --stocks --skip-build`, after audited production/QA builds. Both complete mixed-collateral cycles paid the shop 25 test USDC and restored both collateral balances and zero debt. Health: 1440: 8.0073×, 375: 8.0072×. [Exact hashes/receipts](deployments/qa-browser-equities-2026-11-12T16-04-32-144Z.json). The final run has no page exceptions, console/HTTP errors, failed requests or horizontal overflow. Across every continuation attempt and recovery: 45 transactions, **0.0239850436194411 NEAR fees**, **0.04 NEAR owned-account transfer**, conservative shared budget charge **0.205824392749403300000017 NEAR < 0.5**. Every record is retained in [FLOW-QA.md](FLOW-QA.md#yahoo-stock-payment-completion-2026-11-12).

### Source selection and freshness

`scripts/equity-source.ts` reads **PYTH_API_KEY by environment-variable name only**. When set, it sends Pyth an Authorization header in Node; otherwise it reads Yahoo chart metadata with a normal browser User-Agent. A configured but invalid Pyth key fails explicitly. No key enters Vite, URLs, the app, logs or evidence. The Pyth authenticated transport is unit-tested; no live Pyth key was used in this run.

Yahoo validation checks the requested ticker, USD currency, positive price, original `meta.regularMarketTime`, regular trading period and future timestamps. The contract's signed-price format, replay protection and **90-second freshness rule are unchanged**. After market close, the last price retains its age; new posts are refused outside regular trading, and old quotes cannot keep borrowing open. The app reads signed NEAR state and labels it “Yahoo Finance quote, signed by Noren’s relayer — testnet”; it makes no browser Yahoo/Pyth requests.

The Node regression tests cover an upstream outage with a still-fresh on-chain price, rejecting stale (91 seconds), future, unverified, malformed, mismatched-ticker and unknown-source inputs. Reuse copies the exact on-chain price and timestamp, never the local time. Reposting the same publication is skipped to respect contract anti-replay checks. Quote reads happen under the Chrome lock immediately before a viewport's actions, avoiding an expired preflight quote after a long build/lock wait.

### Retry and recovery evidence

The first 1440 cycle passed. During 375, Yahoo returned 429; the old harness wrongly expected a stale-price error while the contract still held a fresh signed quote. Its 0.01 test USDC error probe therefore paid the shop, as the contract allowed. The overall run remains FAILED with every hash retained. The position was repaid and both collateral deposits returned via the same call pipeline. A 0.04 NEAR transfer from the owned root replenished the demo signer's gas reserve; no external helper or mainnet funding was used. One initial local recovery gas-query adapter error produced no transaction and remains recorded separately.

The corrected harness prefers an original, verified on-chain quote while it is within 90 seconds, never sends a borrow as an error probe against fresh prices, and supports `--width=375` / `--width=1440`. The targeted 375 rerun passed. All failed and successful records remain in deployments; none was rewritten as a pass.

The continuation uses unique ledger filenames tagged `equity-source-2026-11-12`. `scripts/equity-budget.mjs` enforces a shared **0.5 testnet NEAR cap** across native calls, recovery/funding and stock browser runs. Completed runs charge actual fees/allocations; failed or in-flight runs retain their full gas reservation. The BTC-only runner retains its previous 0.3 cap. No keys are copied or printed; browser signing uses only the existing gated localhost injection, without trace/HAR/video.

Before/after production checks captured six existing screens at both sizes: **12 before + 12 after**, no page exceptions, console/HTTP errors, failed requests or horizontal overflow in the after pass. CSS, fonts, colors, layout rules and artwork are unchanged. Paid-flow captures additionally show the signed source, borrowed health, receipts, stock yield guard and restored positions. Screenshots were captured locally during QA and are not committed.

## Test stock demo (2026-11-12)

**Historical pass before the Yahoo fallback.** Its price-source blocker is superseded by the continuation above.

These results describe the earlier native-stock pass, before the Yahoo continuation. **30 tests passed:** 3 contract unit tests, 6 real nearcore sandbox tests, 9 SDK tests, 2 MCP tests (read-only live testnet contract) and 10 web tests. Credit Wasm, SDK, MCP and production web builds passed. Rust remains pinned to 1.95.0. The full final sandbox run used one test thread and passed all 6 cases in 95.46 seconds. The earlier new-case attempt exposed an underfunded test fixture; after correcting the fixture, the complete suite passed.

- `pnpm near:test`: migration preserves v1 assets, collateral, loans, credits, LP balances, locks, installments and relayer key. Zero-amount withdrawn stock entries no longer poison fresh BTC credit. Mixed collateral gives $65 credit from $50 BTC at 50% plus $100 stock at 40%; over-borrow and forged prices fail, stale stock blocks a new draw, and a stock price drop makes health < 1 and liquidation succeed.
- `pnpm --filter @noren/near-sdk build` and `pnpm --filter @noren/near-sdk test`: US-equity feed IDs, exact integer price scaling, original publication timestamps, closed-market staleness and explicit 401/429 failures. No timestamp is replaced with the local clock.
- `pnpm test`: exact call builders, rollback/refund checks, FINAL polling, wallet errors and testnet/localhost QA signing guards.
- `pnpm --filter @noren/near-mcp build` and its test command with `NOREN_LIVE_CONTRACT` / `NOREN_LIVE_ACCOUNT`: both real stdio/live-view checks passed.

### Deployed state

[Stock setup evidence](deployments/stock-demo-2026-11-12.json) records every setup transaction, including the first failed upgrade and its rollback, the successful upgrade + `migrate`, internal reserve transfers, three token issuances, credit storage registration and asset configuration. The public global FT implementation is pinned by immutable hash. Each test stock has 8 decimals and 100 preissued tokens for alice; metadata explicitly says TEST and not real shares. No external funding helper was called.

Credit Wasm SHA-256: `3eb19fbcb542b53fb7f244f419c88022af6699576ddaf67eaaf24e4594719112`. Stocks: 40% LTV / 50% liquidation; BTC: 50% / 60%. Schema 2 preserves the original deployed credit account and positions. No real issuer shares were tokenized.

### Run the stock browser path

```sh
pnpm test:e2e --stocks
# Optional existing demo credential file path; never pass a private key:
pnpm test:e2e --stocks --key-file .near-credentials/testnet.json
```

The runner builds ordinary production (even with the QA flag set) and isolated QA mode, verifies production excludes the signer/injection hooks, checks balances, then uses Chrome under the shared orchestration lock at 1440 and 375. Only the existing demo sub-account key enters an ephemeral localhost page via `addInitScript`; the relayer key stays in Node. No trace/HAR/video or credential copy is made. The same browser call pipeline signs the collateral actions and checks real FINAL receipts and on-chain positions. Screenshots are stored outside the repo in the orchestration shots directory under `noren-near/stocks/qa-signer`.

The stock mode deposits 0.0001 test WBTC and 1 tTSLA. With fresh source quotes it relays BTC + TSLA, borrows/pays 0.01 test USDC, checks debt, repays and withdraws both tokens. With unavailable or old quotes it asserts the stale-price error **before a borrow submission**, withdraws both deposits and requires the original balances, zero debt and unchanged shop balance. This intentionally exits **2 (`BLOCKED_PRICE_SOURCE`)**, not PASS for a stock payment. The existing BTC-only mode remains `pnpm test:e2e`.

Both modes retain the aggregate 0.3 NEAR QA cap across dated ledgers. Stock mode additionally checks this task's one-NEAR bound including setup fees and all setup allocations (even internal transfers, conservatively). Low balances stop signing. HTTP 429 at stock preflight stops the run. Reaching a browser lock does not make a preflight quote fresh: a previously fresh quote is re-read immediately before the draw path. Human Meteor approval remains a manual check.

**Recorded stock browser result:** real WBTC + tTSLA deposit and withdrawal passed at 1440/375, with pending/final receipts and restored balances. Stock borrowing was refused before submission; shop balance unchanged. Eight browser transactions spent **0.004999678681768 NEAR**. The run intentionally exited 2 / `BLOCKED_PRICE_SOURCE`. Setup plus browser fees were **0.0335369134673732 NEAR**; the conservative task bound including setup allocations and full browser gas reservations was **0.3242872347856052 NEAR**, below 1. [Every hash and postcondition](deployments/qa-browser-2026-11-12.json). No new stock-backed payment or repayment is claimed. One earlier queued run was cancelled with zero calls authorized; its record remains.

### Public data / production UI

`pnpm near:stock-prices --check` performs no signing and currently stops at unauthenticated Hermes HTTP 401. Main, beta and legacy latest-price routes were checked. Public metadata identifies the equity feeds, but it is not a price. Current [Pyth documentation](https://docs.pyth.network/api-reference/hermes/latest-price-updates) requires API authorization. No key was supplied or used. The app shows an unavailable-price message (Chrome also observes a failed/CORS read) and retains any last signed timestamp; older than 90 seconds blocks borrowing. A completed stock-backed payment is **BLOCKED**, not inferred from sandbox or older BTC evidence.

Production screenshots: 12 before captures and 22 after captures at 1440/375 under the shared Chrome lock. After captures include credit, account, BTC/stock deposit controls, Pay, Debt-free, About and actual BTC/ETH/SOL/ZEC 1Click dry-quote results. No page exceptions or horizontal overflow; the expected Hermes request failure is recorded. No fonts, colors, CSS/layout rules or artwork changed. Screenshots were captured locally during QA and are not committed. See [FLOW-QA.md](FLOW-QA.md#native-test-stock-flow-2026-11-12).

## Earlier R3 NEAR tree cleanup (2026-11-12)

The current tree has only the NEAR contract, SDK, MCP and web packages. The old multi-chain suites are not installed or counted. `pnpm install --frozen-lockfile` passed after a separate lockfile regeneration. Rust is pinned locally to 1.95.0; both the test-token and credit Wasm builds passed.

Executed and passed after cleanup: **5 sandbox tests, 6 SDK tests, 2 MCP tests (read-only live contract), 10 web tests**, plus **8 read-only production browser route/size checks** at 1440/375. SDK, MCP and production web builds passed. The sandbox suite used one test thread to limit RAM. An initial Rust 1.94 invocation was rejected before tests; the pinned-toolchain run passed. The gate no longer invokes removed destination quotes or inherited screens.

The 12 before/after screenshot pairs preserve the approved UI: 11 are pixel-identical; the mobile landing differs only in its unchanged ambient canvas draw. Full methodology, filenames and the literal-grep exception are in [FLOW-QA.md](FLOW-QA.md#r3-repository-cleanup-2026-11-12). Screenshots were captured locally during QA and are not committed.

**NEAR spent: 0. No new public testnet hashes.** No credentials were read and no public transaction command was run. Existing deployment evidence was not rewritten; only the explicitly requested retired deployment was deleted. Memory/disk checks passed and all started previews/browsers were closed.

The exact substring grep still reports NEAR identifiers, Rust platform dependency names and bytes inside approved artwork. The whole-word audit finds only the prior-work disclosure. This literal acceptance exception is recorded in [BLOCKED.md](BLOCKED.md#r3-literal-grep-criterion).

## Real browser QA signer e2e

Run on macOS with Node 22.22.2+, pnpm 10.29.2, installed Google Chrome and the shared Chrome-lock module at the path used in `scripts/near-browser-e2e.mjs`. No browser download is required; Playwright uses `channel: 'chrome'`.

```sh
pnpm install
pnpm --filter @noren/near-sdk build
pnpm test:e2e --key-file .near-credentials/testnet.json
```

The path is an existing local credential file, never a key value. Default is `.near-credentials/testnet.json`; it must provide the existing demo sub-account signer and relayer key. Alice must start debt-free with no collateral locked, at least 0.0001 test WBTC, 0.04 test USDC and 0.09 usable testnet NEAR. Low funding stops the test before signing. Do not reset/delete the dated QA ledgers to bypass the aggregate 0.3 NEAR cap.

The runner checks memory and disk before each build/browser, waits while free memory is below 30%, stops below 5 GB free disk, builds ordinary production plus an isolated QA output, and finds a free loopback port in 5300-5999 using lsof. It never uses 8787. The same browser is used under `withChromeLock`; all started previews, pages and the browser close in finally blocks. `--skip-build` is available only for reusing already-built outputs; both output audits still run.

The QA build needs both `--mode qa` and `VITE_QA_SIGNER=1`. A normal production build cannot include the adapter even if that flag is accidentally set. To inspect it without signing:

```sh
VITE_QA_SIGNER=1 pnpm --filter @noren/web build
rg -n 'qa-signer|__NOREN_QA_SIGNER__|__norenQaAuthorize' packages/web/dist
```

Expected grep result: no matches (exit 1). The e2e runner asserts this itself, then builds QA mode into `.near-build/qa-web`, outside the production `dist`. Do not publish that QA directory. The adapter rejects non-loopback pages, non-`.testnet` accounts, mainnet RPC, other receivers, non-function-call actions and excessive gas/deposits. It supports wallet-selector-style `getAccounts`, `signAndSendTransaction` and sequential `signAndSendTransactions`.

Node injects the demo key through `page.addInitScript`; signing happens in the browser. The injection is consumed/deleted and the SDK signer stays in memory. The separate relayer key stays in Node for price signatures and Node-signed price refreshes. No key is printed, copied, committed, recorded in browser storage or passed through the environment. No Playwright trace/HAR/video/persistent profile is enabled. Only public transaction metadata and screenshots are saved.

**Recorded result (2026-11-11 UTC): PASS at 1440 and 375.** Both complete cycles used real transactions: connect, deposit 0.0001 test WBTC, borrow/pay the shop 0.01 test USDC, repay 0.02 (excess refunded), withdraw, check restored zero-debt position and sign out. Pending/final receipts and NearBlocks links passed. The shop gained exactly 0.02 test USDC. The clean run finalized eight browser calls plus two price refreshes and spent **0.0056031176347174005 NEAR**. Including the earlier failed post-flow diagnostic attempt: **0.0084046764520761 NEAR**. The clean run had zero page exceptions, console/HTTP errors, failed requests and horizontal overflow.

Ten unit tests passed: `pnpm exec vitest run packages/web/src/near/qa-signer.test.ts packages/web/src/near/credit-calls.test.ts packages/web/src/near/credit-runtime.test.ts`. Production and QA builds passed. Public hashes, receipt fees and balances: [deployments/qa-browser-2026-11-11.json](deployments/qa-browser-2026-11-11.json). Screenshots, audit details, the initial attempt and the remaining manual Meteor approval check: [FLOW-QA.md](FLOW-QA.md#qa-signer-real-browser-transactions-2026-11-11-utc).

## NEAR-only web entry (2026-11-11)

- The production entry imports only NEAR screens. `/` and all inherited or unknown hash routes canonicalize to `#/near/app`. The informational page remains `#/near`; payment and projection tabs are `#/near/app/pay` and `#/near/app/melt`.
- The existing component styling is unchanged. Only NEAR payout controls and NEAR-side catalog representations render. No merchant backend or other-chain RPC is required. Inherited code stays in git; unrelated public assets are excluded from the output.
- Final typecheck/build passed with a 1536 MB Node heap; free swap was 1045 MB before building. Eight credit-call/runtime tests and the wallet-cycle dry run passed. No additional NEAR was spent; the earlier real shared-call proof remains the financial integration evidence.
- Chrome under the shared lock, 1440/375: 64 route/error captures, 26 wallet state captures, actual Meteor testnet popup/closed/blocked checks, catalog label and delayed-price checks. Normal route views had no page exceptions, console errors, failed requests, forbidden-chain requests or horizontal overflow. The outage check deliberately injected HTTP 503. Financial browser state checks use Meteor/position fixtures replaying the real proof's receipts; human wallet approval is manual.
- Literal case-sensitive scan of the complete production output: `Arc`, `Robinhood`, `CCTP`, `arc.io` each **0** matches. `rg -n 'Arc|Robinhood|CCTP|arc\.io' packages/web/dist` also found none. No CSS or artwork changed.
- Current flow, limits, before/after screenshots and raw evidence: [FLOW-QA.md](FLOW-QA.md#near-only-entry-2026-11-11). The older multi-chain sections below are historical, excluded from this NEAR entry.

## Meteor wallet addition (2026-11-11)

- **Build:** production web typecheck/build passed with `NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter @noren/web build`. A 1024 MB heap attempt exhausted its heap; the bounded 1536 MB build passed. Swap was checked before builds.
- **8 tests passed:** `pnpm exec vitest run packages/web/src/near/credit-calls.test.ts packages/web/src/near/credit-runtime.test.ts`. They cover exact token units/receivers, signer-only withdrawals, testnet restrictions, popup/balance/stale-price messages, FINAL polling and rejection of refunded/rolled-back transfers.
- **Real testnet proof passed:** `pnpm near:wallet-cycle --key-file .near-credentials/testnet.json` imports the browser's exact `runCreditAction` pipeline. Five transactions finalized: deposit 0.0001 test WBTC, post a fresh signed price, borrow 0.01 test USDC directly to the shop, repay and withdraw. Alice ended with debt 0 and restored collateral; the shop gained exactly 0.01 test USDC. Measured spend: **0.00280155882 NEAR**, below 0.3. [Raw calls, hashes and postconditions](deployments/wallet-cycle-2026-11-11.json).
- **Wallet packages:** Wallet Selector core and Meteor module are pinned to 10.1.4. The Kotoba-style package extensions isolate near-api-js 6.2.5 and @near-js/utils 2.5.1; root script SDK remains 7.3.1. A pnpm patch removes the pinned Meteor SDK's generated access-key console log from both entry points.
- **Browser:** 20 financial/error state captures at 1440/375 had zero page exceptions and horizontal overflow; a final account-input sync regression also passed at both widths. Actual Meteor testnet popup, closed-window and blocked-popup behavior checked at 1440/375 under the shared Chrome lock. Financial UI state tests use a test-only Meteor transport/position fixture and replay the real proof's FINAL receipts; no browser transaction is broadcast by these fixtures. Human Meteor login/approval remains manual. Screenshot and protocol evidence: [FLOW-QA.md](FLOW-QA.md#meteor-wallet-addition-2026-11-11).

## NEAR edition (2026-11-09)

Recorded results from this branch; the earlier multi-chain figures are on branch `main`. These are dated runs, not current balance or transaction totals; later demo runs append to the deployment log. Nothing here uses a mocked client or a stubbed RPC: the contract tests run signed transactions on a real nearcore sandbox, and the testnet and quote checks hit the live networks.

| Verification | Command | Result |
| --- | --- | --- |
| Contract against a real nearcore 2.14.0-rc.4 sandbox (near-workspaces 0.24.0-rc.2) with a real NEP-141 token | `pnpm near:test` | **5 passed, 0 failed** |
| ↳ `real_token_credit_borrow_yield_repay_withdraw` | | pool, collateral, LTV limit, borrow, interest accrual, harvester credit from the configured source, repay, withdraw, LP withdraw |
| ↳ `attacks_reject_on_chain` | | premature yield refunded, borrow without collateral, forged `ft_on_transfer`, unauthorized oracle, attacker callback, double credit, stale oracle price, stale borrow, over-LTV borrow, stale withdrawal under debt |
| ↳ `liquidation_and_installment_schedule` | | Pay in 3 schedule, early instalment rejected, healthy liquidation rejected, liquidation after a price drop with 5% bonus |
| ↳ `signed_relayer_price_is_verified_on_chain` | | wrong key, tampered price, stale signature and replayed older price all rejected; a genuine signature relayed by anyone accepted; `signed_price_message`, `assets` and `position` views |
| ↳ `max_borrow_is_not_instantly_liquidatable_and_credit_is_withdrawable` | | limit + 1 unit rejected, max borrow safe after interest (10-point liquidation buffer), unused liquidation credit withdrawn, over-withdrawal rejected |
| Testnet lifecycle on public NEAR testnet | `pnpm near:testnet` | **28 transactions** recorded in [`deployments/testnet-2026-11-09.json`](deployments/testnet-2026-11-09.json): deploy, configure, pool, two collateral deposits, 3 attacks rejected on-chain, 4 signed relayer prices, two borrows paid to a merchant, repay, withdraw. Harvest **BLOCKED** (no testnet yield source). After the run: alice debt 0 and 0.01 test WBTC back in her account; bob 12 USDC open; pool 488 test USDC available. |
| One live borrow on public NEAR testnet | `pnpm near:borrow --relay` | **passed** on 2026-11-10 08:51 UTC: 2 transactions appended to [`deployments/testnet-2026-11-09.json`](deployments/testnet-2026-11-09.json) (30 steps immediately after this run; subsequent demo runs append more): a fresh signed price ([3y4Awij9ix…](https://testnet.nearblocks.io/txns/3y4Awij9ixX2nMME8TeNfB7n5CqEhSarJy87yytKTp2J)) and a 1 test USDC `borrow` paid to `shop.…` ([FMVTHShc62…](https://testnet.nearblocks.io/txns/FMVTHShc62cZdUNBBA1tg5mWmqNWT5U67DxaPLmj33RV)), callback `true`, `ft_transfer` receipt to the shop, bob's debt 12.00 → 13.00, shop +1.00 test USDC (checked by the script from the views). `--dry` and the stale-price, bad-option and missing-key-file paths were run too and stop before signing |
| `@noren/near-sdk` | `pnpm --filter @noren/near-sdk test` | **4 passed, 0 failed** |
| `@noren/near-mcp` over real stdio | `NOREN_LIVE_CONTRACT=credit.noren-near-mw9h22el.testnet NOREN_LIVE_ACCOUNT=bob.noren-near-mw9h22el.testnet pnpm --filter @noren/near-mcp test` | **2 passed, 0 failed**: tool list + Setup required without a contract; `credit_status` and `harvest_preview` against the live testnet contract |
| 1Click mainnet API | `pnpm near:quotes` | **5 `dry: true` quotes** saved with timestamps in [`deployments/quotes-2026-11-09.json`](deployments/quotes-2026-11-09.json); catalog 216 assets, tokenised stocks listed: none |
| Headless Chrome on the production build (`vite build`, `vite preview`) | `pnpm near:browser` | **4 checks passed**: `#/near` and `#/near/app` at 1440 and 390 px. Non-empty root, 0 page errors, `scrollWidth == innerWidth`, live 1Click catalog and contract reads rendered, `Setup required: NEAR_MAINNET_ACCOUNT` visible, and at 1440 a live `dry: true` spend quote rendered in the Pay tab |
| Web typecheck and build | `pnpm --filter @noren/web build` | passed |

`pnpm near:verify` runs all of the above except the testnet lifecycle and the live borrow, which spend testnet NEAR (and the borrow adds to bob's debt).

earlier multi-chain edition: see branch main
