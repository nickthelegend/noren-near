# NEAR HACKATHON submission worksheet

Draft for Nick to review and enter in the [official form](https://nearhackathon.com/#apply). Checked against [HACKATHON.md](https://nearhackathon.com/HACKATHON.md) on 2026-11-11. Deadline: **2026-11-14 23:59 UTC**. This worksheet has not been submitted.

| Field | Value / rule |
| --- | --- |
| projectName | Noren on NEAR (13 characters; allowed: 2-80) |
| leadName | TBD Nick (2-80 characters) |
| email | TBD Nick (valid email, max 160 characters; max 2 submissions per email) |
| size | TBD Nick: one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| tracks | Proposed, best first: `["defi", "realworld"]`.<br>`defi` - Collateral-backed lending on NEAR, with repayment, withdrawal, liquidation and cross-chain dry quotes.<br>`realworld` - Borrowed test USDC is paid straight to a merchant's NEAR account; cross-chain merchant payouts are dry quotes only. |
| nearAddress | TBD Nick: NEAR MAINNET payout account (2-64 characters, lowercase named or 64-character implicit account; not the testnet contract) |
| projectUrl | TBD: public GitHub repo URL after push (http(s), max 300 characters; each repository may be submitted once) |
| demoUrl | TBD: the public X post URL (http(s), max 300 characters) |
| idea | Crypto holders who need spending money may have to sell assets they want to keep. Noren on NEAR explores paying a merchant from a collateral-backed credit line. Its Rust contract runs on NEAR testnet: borrowers deposit test WBTC through NEP-141 transfer callbacks, borrow test USDC up to 50% of collateral value, pay a merchant's NEAR account directly, repay and withdraw. The contract verifies signed Coinbase BTC prices and uses private callbacks to restore state after failed transfers. Recorded testnet transactions show the lifecycle and rejected attacks; sandbox tests also cover liquidation and Pay in 3. The local app connects Meteor Wallet for testnet credit actions and requests live NEAR Intents 1Click dry quotes for cross-chain routes. Mainnet execution and a real yield adapter remain unfinished. The debt-free date is a projection using Rhea's live supply rate, not earned yield. Arc and Robinhood Chain features are inherited work excluded from this NEAR entry. |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Idea character count: **977** (plain text in the `idea` row; allowed: 20-2000).

## X post draft

The human posts this with the video attached. Draft text: **236 characters**, within 280.

```text
need spending money without selling your crypto? noren's NEAR testnet credit line pays a merchant against test WBTC. built at NEAR HACKATHON @NEARProtocol #NEARHackathon. cross-chain routes are dry quotes. watch the demo + send feedback
```

attach: /Volumes/Extreme SSD/Projects/grokbot/videos/noren-near/noren-near-film-share.mp4

## Before submission

- Nick fills the personal fields, confirms the project name and tracks, and replaces the README's other-projects placeholder with the names and links (or confirms none). Each independent entry must disclose the others; one person may enter at most two projects.
- Publish the repository with its MIT LICENSE before the deadline. The hosted Arc/Robinhood links in the README describe the inherited edition; the NEAR demo is local. Its X post needs the demo video; screenshots alone do not satisfy the local-only rule.
- Recheck the live rules. Q-001 currently allows work since the Oct 19 announcement; this pack uses the requested stricter Nov 1 baseline and excludes the inherited Arc/Robinhood work anyway.
- Submit once after Nick confirms the completed fields and consent. For an API submission, generate `requestId` once at submission time and reuse it on retries; it is an API field, not a human form field. Keep the personal payload out of git. Leave the form's hidden `website` spam trap empty.
- If a saved submission needs correction, use [request changes](https://nearhackathon.com/request-changes).
