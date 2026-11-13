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
| idea | Noren brings its merchant checkout and stock-backed credit to NEAR testnet. Selling an asset you want to keep just to buy something can lose its future gains. Keep TEST Tesla, Nvidia, Apple and BTC tokens as collateral instead: the native Rust credit contract pays borrowed test USDC straight to a shop's named NEAR account. TEST stocks are not real shares. The original Noren Merchant, Aubelle demo shop and six-tab app now use Meteor wallet signing, verified merchant sessions and invoice-bound FINAL NEAR receipts. Two browser USDC payments passed at 1440 and 375; earlier native and browser stock-credit cycles paid shops, repaid and restored collateral. A separately funded buyer supports direct TEST-stock sales without using credit LP funds; sale/refund safety is tested in the NEAR sandbox. Stocks have 40% LTV and BTC 50%, with health and liquidation checks. Yahoo Finance equity quotes are signed by Noren's relayer; Pyth is optional with operator authorization. Publication times are preserved and prices expire after 90 seconds. Pay in 3 schedules due credit draws; scheduling alone pays nothing. Intents provides mainnet dry quotes only. Payments are public; private checkout, real mainnet funding, stock yield, refunds and signed webhooks are not integrated. Only the NEAR-specific work is submitted. |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Idea character count: **1314** (plain text in the `idea` row; allowed: 20-2000).

## Risks / disclosures

Prior work: Noren at ETHGlobal (Arc), Nov 2026; this is the NEAR edition. Noren's [Avalanche edition](https://noren-avax.vercel.app/) was built on Nov 12, 2026. Only NEAR-specific code built during Nov 1-14, 2026 is submitted here; Avalanche work is excluded.

The film (noren-near-film-share.mp4, 3:12) is one live NEAR-testnet run recorded on Nov 13 during US market hours: a stock sale at a live Yahoo price, a USDC link payment, stock collateral, Pay later, Pay in 3, repayment and withdrawal of the same shares, 16 FINAL transactions listed in the README. Merchant metadata is local service data, not an on-chain registry. Hosting still needs Nick’s approval. The contract trusts Noren’s relayer signature, not a native Yahoo/Pyth proof. Test stocks are not issuer shares; quotes keep their source timestamp and expire after 90 seconds. Human Meteor approval is manual; the film uses the isolated QA signer. Private checkout is not built on NEAR. Mainnet funding via Intents is a dry quote only.

## X post draft

The human posts this with the video attached after the new film is complete. Draft text: **203 characters**, within 280.

```text
keep your tesla. buy the thing. noren brings shops, TEST stocks and stock-backed credit to NEAR testnet. test tokens, public payments, no real shares. built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

attach: noren-near-film-share.mp4

## Before submission

- Nick fills the personal fields, confirms the project name and tracks, and replaces the README's other-projects placeholder with the names and links (or confirms none). Each independent entry must disclose the others; one person may enter at most two projects.
- Publish the repository with its MIT LICENSE before the deadline. The README describes the local NEAR-only demo. Its X post needs the demo video; screenshots alone do not satisfy the local-only rule.
- Recheck the live rules. Q-001 currently allows work since the Oct 19 announcement; this pack uses the requested stricter Nov 1 baseline and excludes earlier-chain work anyway.
- Submit once after Nick confirms the completed fields and consent. For an API submission, generate `requestId` once at submission time and reuse it on retries; it is an API field, not a human form field. Keep the personal payload out of git. Leave the form's hidden `website` spam trap empty.
- If a saved submission needs correction, use [request changes](https://nearhackathon.com/request-changes).
