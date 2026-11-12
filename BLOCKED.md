# NEAR edition: blocked and setup-required items (updated 2026-11-12)

Nothing below is faked in the code, the app or the README. No mainnet transaction was sent.

| Item | Status | Exactly what unblocks it | What the build shows instead |
| --- | --- | --- | --- |
| Yield harvest that pays the debt (`harvest`) | **BLOCKED on testnet** | No real yield source exists on NEAR testnet for this collateral: Rhea lending and NEAR Intents (to turn yield into USDC) are mainnet-only. On mainnet: a funded `NEAR_MAINNET_ACCOUNT`, plus engineering work: a Rhea supply adapter for the exact market tokens, share accounting and unwind, measured accrued yield, an Intents swap to USDC, and a permissionless `harvest()` that sends it in as `kind: yield`. | The contract's harvester path (`Deposit::Yield` from the configured yield source) is covered by the sandbox tests only. The app's "Debt-free on" date and curve are labelled **Projection**, computed from the live position and Rhea's live WBTC supply APY. The Harvests card is empty with this reason. |
| Mainnet deposits through 1Click | **Setup required: NEAR_MAINNET_ACCOUNT** | A funded `NEAR_MAINNET_ACCOUNT`, origin-chain collateral and a refund address, and an attribution path: a 1Click quote ID or status response is off-chain and cannot by itself credit a borrower on-chain. The safe flow is: 1Click to the borrower's own NEAR/Intents account, withdraw, then `ft_transfer_call` to Noren. | SDK dry-quote evidence is recorded separately; the web build offers BTC/ETH/SOL/ZEC mainnet arrival dry quotes as well as the NEAR-side catalog. Nothing moves on testnet. Native TEST stocks and test WBTC are the only configured collateral. |
| Paying merchants on Base or Arbitrum | **Setup required: NEAR_MAINNET_ACCOUNT** | Funded mainnet account and a 1Click executor (sign, deposit, poll `/v0/status`, reconcile refunds). | Historical SDK dry quotes are recorded in `deployments/quotes-2026-11-09.json`; other-chain destination controls are excluded from the NEAR web build. On testnet, `borrow` pays the merchant's NEAR account directly (recorded tx `S66b6sCDK7…`). |
| Withdraw to the coin's origin chain | **Setup required: NEAR_MAINNET_ACCOUNT** | Same 1Click executor, origin-chain address. | `withdraw` returns the NEP-141 collateral to a NEAR account (recorded tx `7CHeCt7N6G…`). |
| Signing from the browser | **Implemented on NEAR testnet** | The human connects a funded Meteor testnet account and approves requested calls; the operator refreshes stale prices. | Deposit, borrow/pay, repay and withdraw use wallet-signed calls with FINAL polling and NearBlocks links. Popup/cancellation checks and shared-call proof: [FLOW-QA.md](FLOW-QA.md#meteor-wallet-addition-2026-11-11). |
| Mainnet price | **Setup required: NEAR_MAINNET_ACCOUNT** (deployment) | Point `oracle` at Rhea's `priceoracle.near` (verify the ID at deploy time) and have it call `oracle_on_call`. Pyth Core ended NEAR support on 2026-08-26. | Testnet uses the documented relayer: Coinbase BTC-USD spot, ed25519-signed, verified on-chain, labelled "relayer price (testnet)". |
| Stock-backed borrowing / shop payment | **BLOCKED: public Pyth latest-price HTTP 401** | A working authorized or unauthenticated Hermes US-equity price source. The task requests public/no-key access; no authorization was supplied. [Current Pyth docs](https://docs.pyth.network/api-reference/hermes/latest-price-updates) require an API key. Main, beta and legacy latest-price routes were checked and returned 401. Metadata/feed discovery still works. Never replace the price or re-stamp a last-market quote. | Three clearly labelled TEST NEP-141 stocks are issued, configured at 40% LTV and depositable. Stocks are not real shares. The UI shows unavailable pricing; no real stock-backed borrow/payment is claimed. Migration and risk checks pass in sandbox. |
| Private merchant payments (Confidential Intents) | **Not integrated** | Holding an embedded Confidential Intents balance and submitting signed private orders. | The NEAR position and payments are public. No private or other-chain execution is exposed by this web build. |
| Pay in 3 automation | **Keeper not running** | A keeper calling `pay_installment` when each draw is due. | The on-chain schedule and due-time checks are tested in the sandbox; the app previews the three draws. |
| Hackathon submission | **Nick** | Lead/team fields, prize account, publishing branch `near`, X post, consent. | See [HACKATHON_SUBMISSION_FORM.md](HACKATHON_SUBMISSION_FORM.md). |

## Exact requirement for a real ZEC deposit

The ZEC control requests `dry: true` from `zec.omft.near` into a mainnet NEAR Intents balance. It does not send ZEC, mint collateral or make a testnet credit entry. A real deposit needs funded ZEC on the origin chain, a supported origin/refund address, a funded **NEAR mainnet** user account for gas/storage, a non-dry 1Click order with settlement/refund reconciliation, withdrawal of the received NEP-141 asset from the user's Intents balance, and an authenticated `ft_transfer_call` to a mainnet Noren contract for that user. That exact asset needs configured pricing/LTV and a tested deposit-attribution adapter. An off-chain quote/status response alone cannot credit collateral. No such mainnet execution or adapter was built or funded in this task.

Outside US-equity market hours the relayer preserves the original Pyth publication time and the app shows its age. Older than 90 seconds blocks new borrowing and debt-bearing withdrawals; repayment and debt-free withdrawal remain available. When Hermes returns no price, there is no last price to invent. The stock rows remain awaiting a signed price.

`ONECLICK_JWT` is optional for dry quotes; without it the unauthenticated fee applies to live execution.

## Original Nov 9 testnet funding note

The NEAR account helper returned HTTP 429 all session. The root account `noren-near-mw9h22el.testnet` was created through the `testnet` registrar with 4 NEAR from a shared testnet funder (the cap per project). That budget is why the original BTC run used Ref Finance's public test tokens. The Nov 12 stock task used existing owned balances and immutable global FT code; no helper request or external funding was made.

## R3 literal grep criterion

During the earlier R3 cleanup, before the stock work, the inherited-chain packages, screens, scripts/docs and retired deployment were removed from `near`. Install, NEAR builds/tests and the unchanged-UI checks pass; 0 NEAR was spent and no new testnet hash was created.

**BLOCKED: exact substring-only acceptance.** The requested case-insensitive `arc` pattern also matches `NearCredit`, `nearcore`, `nk-search`, `fromCharCode`, the legitimate Rust `windows_aarch64_*` dependency names and binary bytes in the approved price-tag WebP. Seventeen output lines remain, including the intended README prior-work disclosure. These matches are not another-chain product code. The approved asset and exact dependency lock entries were preserved. A whole-word text audit finds only that disclosure:

```sh
git grep -n -i -w -E 'arc|robinhood|cctp|ccip' -- README.md packages/
```

No need to change product design or contract behavior was found. The remaining functional blockers above still apply: a fresh operator-signed price is required before borrowing; real yield harvesting and mainnet execution are unfinished. Details and executed counts: [FLOW-QA.md](FLOW-QA.md#r3-repository-cleanup-2026-11-12).
