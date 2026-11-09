# NEAR HACKATHON submission worksheet — Noren on NEAR

Source: [live event rules](https://nearhackathon.com/HACKATHON.md), re-read 2026-11-09. This is a draft, not a submitted application. The human decides the fields below and confirms the exact JSON payload before a single POST. No mainnet transaction, publication or post is authorized by this file.

| Human decision required | Draft value |
| --- | --- |
| Project name (2–80 chars) | TBD by Nick |
| Team lead name (2–80 chars) | TBD by Nick |
| Contact email (≤160 chars) | TBD by Nick |
| Team size | TBD by Nick (1, 2 - 4, 4 - 6, 6 - 8, or 8+) |
| Tracks | defi, realworld (requested; Nick confirms) |
| NEAR mainnet prize account | TBD by Nick |
| Public repository URL | TBD by Nick after he makes this repo public |
| Public X demo post URL | TBD by Nick after he publishes the post |
| Consent notice | TBD by Nick after reading the exact text below |

**Consent text to read verbatim:** “I agree that the organizers may use these details to review our submission and contact us about this hackathon.”

## What they built (draft; Nick approves)

Don't sell your Bitcoin: spend against it, anywhere, and let it pay the debt off. Noren on NEAR is a credit line against coins from any chain. The Rust contract `noren_credit` takes NEP-141 collateral only through transfer callbacks, prices it (on testnet with a Coinbase BTC-USD price signed by Noren's relayer and verified with ed25519 inside the contract), lets the borrower draw USDC up to 50% LTV paid straight to any account, accrues interest per second, and handles repay, withdraw, liquidation with a 5% bonus, and an on-chain Pay in 3 schedule. It is deployed on NEAR testnet (credit.noren-near-mw9h22el.testnet), where a full cycle ran with recorded transactions: deposit, signed price, a 25 USDC payment to a merchant on credit, full repayment and withdrawal, plus three attacks rejected on-chain. NEAR Intents 1Click provides the any-chain side (BTC and ZEC in, USDC out to Base and Arbitrum) as live dry quotes; sending them needs a funded mainnet account. The yield harvest that pays the debt down is blocked on testnet (Rhea and Intents are mainnet-only), so the app shows the "debt-free on" date as a labelled projection from the live position and Rhea's live supply rate. Tokenised stocks are not offered: the 1Click catalog lists none. Noren also exists on Arc and Robinhood Chain; only the NEAR integration on branch `near` is entered.

## Pre-submission checks

- Nick publishes the repository before **2026-11-14 23:59 UTC**, and supplies the exact public URL. The README links the main...near diff and names the other NEAR submission if there is one.
- Nick records and publishes an X post saying the project was built at NEAR HACKATHON, tags @NEARProtocol and #NEARHackathon, and attaches a demo video or screenshots.
- Nick confirms the JSON payload for the single POST /api/applications; use a UUID requestId exactly once and reuse it for a network retry. A saved application is corrected at [request changes](https://nearhackathon.com/request-changes), not resubmitted.
- The contract and README must be updated if the blocked integrations become live. The current draft must not be submitted with claims of a working self-repaying mainnet loan.
