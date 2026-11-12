# NEAR HACKATHON submission worksheet

Draft for Nick to review and enter in the [official form](https://nearhackathon.com/#apply). Checked against [HACKATHON.md](https://nearhackathon.com/HACKATHON.md) on 2026-11-11. Deadline: **2026-11-14 23:59 UTC**. This worksheet has not been submitted.

| Field | Value / rule |
| --- | --- |
| projectName | Noren on NEAR (13 characters; allowed: 2-80) |
| leadName | TBD Nick (2-80 characters) |
| email | TBD Nick (valid email, max 160 characters; max 2 submissions per email) |
| size | TBD Nick: one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` |
| tracks | Proposed, best first: `["defi", "realworld"]`.<br>`defi` - Collateral-backed lending on NEAR, with repayment, withdrawal and liquidation.<br>`realworld` - Borrowed test USDC is paid straight to a merchant's NEAR account; this web entry pays only on NEAR testnet. |
| nearAddress | TBD Nick: NEAR MAINNET payout account (2-64 characters, lowercase named or 64-character implicit account; not the testnet contract) |
| projectUrl | TBD: public GitHub repo URL after push (http(s), max 300 characters; each repository may be submitted once) |
| demoUrl | TBD: the public X post URL (http(s), max 300 characters) |
| idea | Selling assets you want to keep just to buy something is frustrating. Noren on NEAR explores keeping collateral and spending against it. Native TEST tTSLA, tNVDA and tAAPL tokens are explicitly not real shares; test WBTC is also supported. The Rust contract sums each asset's priced value times its LTV (stocks 40%, BTC 50%) and pays borrowed test USDC directly to the shop's NEAR account. A real tTSLA-only cycle paid 25 test USDC, then repaid and withdrew the same stock. Mixed stock/BTC browser cycles passed at 1440 and 375 with wallet-signed transactions, FINAL receipts and healthy positions. Yahoo Finance supplies no-key equity quotes; an authorized Pyth key selects Hermes instead. Noren's relayer preserves publication times and signs the existing price format; the contract checks its ed25519 signature, freshness and replay protection. Quotes expire after 90 seconds; closed-market or unavailable prices are never re-timestamped. Sandbox tests cover mixed LTV, stale prices, forged signatures, over-borrowing and liquidation. Meteor and the isolated QA signer share the credit actions. BTC/ETH/SOL/ZEC Bring-coins controls use NEAR Intents 1Click mainnet dry quotes; nothing moves on testnet. Positions and payments are public. Real shares, private payments, mainnet execution and yield harvesting remain unfinished. Earlier-chain work is excluded. |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Idea character count: **1360** (plain text in the `idea` row; allowed: 20-2000).

## Risks / disclosures

Noren's [Avalanche edition](https://noren-avax.vercel.app/) was built on Nov 12, 2026. Only NEAR-specific code built during Nov 1-14, 2026 is submitted here; Avalanche work is excluded.

The Yahoo-priced tTSLA payment and mixed stock/BTC browser cycles are recorded with real testnet transactions. Pyth remains an optional key-gated source. The contract trusts Noren’s relayer signature, not a native Yahoo/Pyth proof. Test stocks are not issuer shares. Quotes keep their source timestamp and expire after 90 seconds. Human Meteor approval is manual; browser automation uses the isolated QA signer. Mainnet ZEC deposits need funding, settlement/withdrawal and a tested NEP-141 attribution adapter.

## X post draft

The human posts this with the video attached. Update the attached film to include the stock run before posting this revised draft. Draft text: **232 characters**, within 280.

```text
keep your tesla. buy the thing. noren's NEAR testnet demo keeps TEST tTSLA + BTC as collateral and pays the shop with borrowed test USDC. no selling. test tokens, not real shares. built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

attach: /Volumes/Extreme SSD/Projects/grokbot/videos/noren-near/noren-near-film-share.mp4

## Before submission

- Nick fills the personal fields, confirms the project name and tracks, and replaces the README's other-projects placeholder with the names and links (or confirms none). Each independent entry must disclose the others; one person may enter at most two projects.
- Publish the repository with its MIT LICENSE before the deadline. The README describes the local NEAR-only demo. Its X post needs the demo video; screenshots alone do not satisfy the local-only rule.
- Recheck the live rules. Q-001 currently allows work since the Oct 19 announcement; this pack uses the requested stricter Nov 1 baseline and excludes earlier-chain work anyway.
- Submit once after Nick confirms the completed fields and consent. For an API submission, generate `requestId` once at submission time and reuse it on retries; it is an API field, not a human form field. Keep the personal payload out of git. Leave the form's hidden `website` spam trap empty.
- If a saved submission needs correction, use [request changes](https://nearhackathon.com/request-changes).
