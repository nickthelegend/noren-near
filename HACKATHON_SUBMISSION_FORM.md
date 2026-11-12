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
| idea | Keep your stocks. Spend against them. Noren on NEAR lets a borrower keep NEP-141 collateral while its Rust credit contract pays borrowed test USDC straight to a merchant's NEAR account. The NEAR-only demo now has native TEST tTSLA, tNVDA and tAAPL tokens, explicitly not real shares, alongside test WBTC. Credit sums each asset's value times its LTV: stocks 40%, BTC 50%, with health and liquidation thresholds. A state migration preserves existing positions. The relayer keeps Coinbase BTC and Pyth US-equity source timestamps and the contract verifies ed25519 signatures, freshness and replay protection. Stock borrowing is currently blocked because unauthenticated Pyth Hermes latest-price reads return HTTP 401; no substitute price or timestamp is used. Earlier real BTC merchant cycles work, and sandbox tests cover mixed collateral, stale stocks, forgery, over-borrowing and liquidation. Meteor and the isolated QA signer share browser credit actions and final receipts. BTC/ETH/SOL/ZEC Bring-coins controls request real NEAR Intents 1Click mainnet dry quotes; nothing moves on testnet. Positions and payments are public; real stock shares, private payments, mainnet execution and yield harvesting are unfinished. Earlier-chain work is excluded. |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Idea character count: **1251** (plain text in the `idea` row; allowed: 20-2000).

## Risks / disclosures

Noren's [Avalanche edition](https://noren-avax.vercel.app/) was built on Nov 12, 2026. Only NEAR-specific code built during Nov 1-14, 2026 is submitted here; Avalanche work is excluded.

Stock tokens are deployed and depositable; fresh-price stock borrowing and its real merchant-payment run remain blocked by unauthenticated Hermes HTTP 401. The app refuses stale/unavailable collateral prices. Test stocks are not issuer shares. Human Meteor approval is manual; earlier BTC browser cycles used the isolated QA signer. Mainnet ZEC deposits need funding, settlement/withdrawal and a tested NEP-141 attribution adapter.

## X post draft

The human posts this with the video attached. Draft text: **219 characters**, within 280.

```text
keep your tesla. buy the thing. noren on NEAR testnet keeps TEST stocks + BTC as collateral. test stocks aren't real shares; stock borrowing awaits Pyth price access. built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

attach: /Volumes/Extreme SSD/Projects/grokbot/videos/noren-near/noren-near-film-share.mp4

## Before submission

- Nick fills the personal fields, confirms the project name and tracks, and replaces the README's other-projects placeholder with the names and links (or confirms none). Each independent entry must disclose the others; one person may enter at most two projects.
- Publish the repository with its MIT LICENSE before the deadline. The README describes the local NEAR-only demo. Its X post needs the demo video; screenshots alone do not satisfy the local-only rule.
- Recheck the live rules. Q-001 currently allows work since the Oct 19 announcement; this pack uses the requested stricter Nov 1 baseline and excludes earlier-chain work anyway.
- Submit once after Nick confirms the completed fields and consent. For an API submission, generate `requestId` once at submission time and reuse it on retries; it is an API field, not a human form field. Keep the personal payload out of git. Leave the form's hidden `website` spam trap empty.
- If a saved submission needs correction, use [request changes](https://nearhackathon.com/request-changes).
