# NEAR edition: blocked and setup-required items (2026-11-09)

Nothing below is faked in the code, the app or the README. No mainnet transaction was sent.

| Item | Status | Exactly what unblocks it | What the build shows instead |
| --- | --- | --- | --- |
| Yield harvest that pays the debt (`harvest`) | **BLOCKED on testnet** | No real yield source exists on NEAR testnet for this collateral: Rhea lending and NEAR Intents (to turn yield into USDC) are mainnet-only. On mainnet: a funded `NEAR_MAINNET_ACCOUNT`, plus engineering work: a Rhea supply adapter for the exact market tokens, share accounting and unwind, measured accrued yield, an Intents swap to USDC, and a permissionless `harvest()` that sends it in as `kind: yield`. | The contract's harvester path (`Deposit::Yield` from the configured yield source) is covered by the sandbox tests only. The app's "Debt-free on" date and curve are labelled **Projection**, computed from the live position and Rhea's live WBTC supply APY. The Harvests card is empty with this reason. |
| Mainnet deposits through 1Click | **Setup required: NEAR_MAINNET_ACCOUNT** | A funded `NEAR_MAINNET_ACCOUNT`, origin-chain collateral and a refund address, and an attribution path: a 1Click quote ID or status response is off-chain and cannot by itself credit a borrower on-chain. The safe flow is: 1Click to the borrower's own NEAR/Intents account, withdraw, then `ft_transfer_call` to Noren. | Live `dry: true` quotes (BTC in, ZEC in). Testnet collateral is `wbtc.fakes.testnet`, a public test token labelled as a stand-in for bridged BTC. |
| Paying merchants on Base or Arbitrum | **Setup required: NEAR_MAINNET_ACCOUNT** | Funded mainnet account and a 1Click executor (sign, deposit, poll `/v0/status`, reconcile refunds). | Live `dry: true` quotes in the app and in `deployments/quotes-2026-11-09.json`. On testnet, `borrow` pays the merchant's NEAR account directly (recorded tx `S66b6sCDK7…`). |
| Withdraw to the coin's origin chain | **Setup required: NEAR_MAINNET_ACCOUNT** | Same 1Click executor, origin-chain address. | `withdraw` returns the NEP-141 collateral to a NEAR account (recorded tx `7CHeCt7N6G…`). |
| Signing from the browser | **Not built** | A NEAR wallet connection (wallet-selector) for `ft_transfer_call`, `borrow`, `withdraw`. | The app reads the contract's views only. Testnet transactions were signed by `scripts/near-testnet.ts`; the app says so where you would sign. |
| Mainnet price | **Setup required: NEAR_MAINNET_ACCOUNT** (deployment) | Point `oracle` at Rhea's `priceoracle.near` (verify the ID at deploy time) and have it call `oracle_on_call`. Pyth Core ended NEAR support on 2026-08-26. | Testnet uses the documented relayer: Coinbase BTC-USD spot, ed25519-signed, verified on-chain, labelled "relayer price (testnet)". |
| Tokenised stocks as collateral | **Not available** | A tokenised stock appearing in the 1Click catalog and a NEAR-reachable price for it. | The catalog listed none on 2026-11-09 (216 assets, 39 chains); the app re-checks on load. Stock support is not claimed. |
| Private merchant payments (Confidential Intents) | **Not integrated** | Holding an embedded Confidential Intents balance and submitting signed private orders. | A shielded ZEC source hides where a deposit came from; the NEAR position and payments are public. |
| Pay in 3 automation | **Keeper not running** | A keeper calling `pay_installment` when each draw is due. | The on-chain schedule and due-time checks are tested in the sandbox; the app previews the three draws. |
| Hackathon submission | **Nick** | Lead/team fields, prize account, publishing branch `near`, X post, consent. | See [HACKATHON_SUBMISSION_FORM.md](HACKATHON_SUBMISSION_FORM.md). |

`ONECLICK_JWT` is optional for dry quotes; without it the unauthenticated fee applies to live execution.

## Testnet funding note

The NEAR account helper returned HTTP 429 all session. The root account `noren-near-mw9h22el.testnet` was created through the `testnet` registrar with 4 NEAR from a shared testnet funder (the cap per project). That budget is why the testnet run uses Ref Finance's public test tokens instead of deploying two more token contracts.
