# Noren on NEAR — build report (2026-11-09)

## What works live

- The Rust credit contract runs against a real local nearcore sandbox and a real NEP-141 test token. Signed transactions cover collateral, USDC pool funding, LTV-limited borrowing, interest, funded USDC yield credit, repayment, withdrawal, liquidation, and an on-chain Pay in 3 schedule. The yield credit is supplied by the test source; it is not Rhea earnings.
- The SDK and MCP server read real NEAR/1Click/Rhea endpoints. Three timestamped 1Click `dry: true` quotes are saved in `deployments/quotes-2026-11-09.json`, including a Base destination route. They do not move funds or pay a merchant.
- The NEAR landing and dashboard render in headless Chrome at 1440px and 375px. Both show the live token catalog and honest setup states, with no page errors or horizontal overflow. The 1440px app also obtains a real dry spend quote.

## Verification

`pnpm near:verify` passed: **3/3** real sandbox tests, **4/4** SDK tests, **1/1** MCP protocol test, and **157/157** inherited Vitest tests across 23 files; **0 failed, 0 skipped** in this run. Both browser viewport checks passed. Three live 1Click dry quotes succeeded. Details are in `TESTING.md`.

## BLOCKED

- **Public NEAR testnet:** the [account helper](https://helper.nearprotocol.com/account) and its [testnet alias](https://helper.testnet.near.org/account) returned HTTP 429. There is no deployed contract or testnet transaction hash. Retry `pnpm near:testnet` after the limit resets, or set `NEAR_TESTNET_SPONSOR_ACCOUNT` and `NEAR_TESTNET_SPONSOR_KEY` in the gitignored `.env` for a funded testnet sponsor. The script saves deployment, configuration and signed test transaction hashes with nearblocks links when it can run.
- **Self-repaying mainnet loop:** Rhea supply and harvest, Intents conversion of earned yield to USDC, attributable contract-recipient deposits, cross-chain merchant settlement and origin-chain return are still engineering work. A funded `NEAR_MAINNET_ACCOUNT`, collateral, pool liquidity, and explicit mainnet authorization would also be needed for a live run. No mainnet transaction was sent.
- **Stocks and privacy:** no tokenised stock appeared in the observed [1Click catalog](https://1click.chaindefuser.com/v0/tokens); [Pyth Core ended NEAR support](https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/near). [Confidential Intents](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps.md) is documented but not integrated. A shielded ZEC source does not hide the public NEAR credit position.
- **Submission:** Nick must publish this local branch and fill the human fields in `HACKATHON_SUBMISSION_FORM.md` before the [2026-11-14 23:59 UTC deadline](https://nearhackathon.com/HACKATHON.md). See `BLOCKED.md` for the full list.

## Exact demo commands

```sh
pnpm near:verify
pnpm near:quotes
pnpm --filter @noren/web dev              # open http://localhost:5190/#/near
pnpm --filter @noren/near-mcp start       # stdio; credit reads require NEAR_TESTNET_CONTRACT
pnpm near:testnet                         # retry after helper limit resets, or set sponsor env vars
```
