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

Noren is extending its Arc and Robinhood Chain product to NEAR. The problem is that native cross-chain collateral and merchant payments have no simple, attributable loan path, while idle collateral does not help retire debt. The NEAR edition adds a Rust credit ledger with authenticated NEP-141 deposits, per-asset LTV, fresh oracle gating, USDC pool accounting, interest, liquidations, scheduled Pay in 3 instalments, and a yield-credit path that only accepts actual USDC transferred by a configured source. A React app and MCP tools read testnet position state and call 1Click for live dry quotes. NEAR Intents is the proposed route for origin-chain deposits and destination-chain payments. Full Rhea supply/harvest, contract-recipient 1Click attribution, private merchant settlement, and the funded mainnet loop are **blocked and not claimed live**. Testnet deployment is blocked while the official helper faucet is rate-limited.

## Pre-submission checks

- Nick publishes the repository before **2026-11-14 23:59 UTC**, and supplies the exact public URL. The README links the main...near diff and names the other NEAR submission if there is one.
- Nick records and publishes an X post saying the project was built at NEAR HACKATHON, tags @NEARProtocol and #NEARHackathon, and attaches a demo video or screenshots.
- Nick confirms the JSON payload for the single POST /api/applications; use a UUID requestId exactly once and reuse it for a network retry. A saved application is corrected at [request changes](https://nearhackathon.com/request-changes), not resubmitted.
- The contract and README must be updated if the blocked integrations become live. The current draft must not be submitted with claims of a working self-repaying mainnet loan.
