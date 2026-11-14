# NEAR HACKATHON submission worksheet

Draft for Nick to review and enter in the [official form](https://nearhackathon.com/#apply). Checked against [HACKATHON.md](https://nearhackathon.com/HACKATHON.md) on 2026-11-11 and re-read 2026-11-14. Deadline: **2026-11-14 23:59 UTC**. This worksheet has not been submitted.

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
| idea | People who hold stocks or Bitcoin they want to keep often must sell them to pay for something and lose future gains. Noren on NEAR testnet lets them borrow against those assets instead, with the borrowed dollars paid straight to the shop. It has three parts: Noren Merchant (a shop signs in with a NEAR wallet and creates payment links), a hosted checkout used by a demo boutique, and an app where the buyer locks collateral, borrows, repays and withdraws. At checkout the buyer can pay in test USDC, pay later from credit, split into three payments, or pay with test stock or test BTC. How NEAR is used: the Rust credit contract credit.noren-near-mw9h22el.testnet holds NEP-141 collateral (test BTC and three TEST stock tokens, at 50% and 40% loan-to-value with liquidation checks), checks a signed price that expires after 90 seconds, and pays the borrowed test USDC directly to the merchant's NEAR account. A shopper holding 0 NEAR can pay in USDC through a NEP-366 meta-transaction: Noren's relayer signs and pays the gas, but only for an invoice-bound transfer, at most 3 per shopper per day. In the film, test BTC was locked, a Pay in 3 first draw paid the shop (5HgKMLeYjkRVhYTiYAvAP8RfN6xA48j6PPpcrr1w7QPG), and a gasless payment came from a 0-NEAR wallet (D5BrfNKZVaRGRduwxnWUzf3EAPVMhPorrWoUWX9BvMzb). Limits: testnet only, not audited. All tokens are test tokens; TEST stocks are not real shares. Prices come from Yahoo Finance and Coinbase signed by Noren's own relayer, not an on-chain oracle. Payments are public; private checkout, refunds, webhooks, stock yield and an automatic Pay in 3 keeper are not built. Mainnet funding through NEAR Intents is dry quotes only, and gasless checkout does not work with Meteor yet. Noren first shipped on Arc; only the NEAR work is claimed. |
| consent | Nick ticks after agreeing: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

Idea character count: **1792** (plain text in the `idea` row; allowed: 20-2000).

## Risks / disclosures

Prior work: Noren at ETHGlobal (Arc), Nov 2026; this is the NEAR edition. Noren's [Avalanche edition](https://noren-avax.vercel.app/) was built on Nov 12, 2026. Only NEAR-specific code built during Nov 1-14, 2026 is submitted here; Avalanche work is excluded.

The film is v8 (noren-near-film.mp4, 6:46, recorded Nov 14 on NEAR testnet): landing, Noren Merchant, the Noren app with test BTC locked as collateral (US stock markets were closed, so the film uses test BTC and says so), then four Aubelle checkouts through the Pay with Noren pop-up (Pay in 3, Pay later, pay with test BTC, gasless USDC from a 0-NEAR wallet), repay and payouts. Every signature shows the QA test wallet's Approve sheet, then its explorer page; ledgers and hashes are in the README. For X, a 2:19 version (noren-near-film-x139.mp4: scenes removed, then played at 1.5x) is attached. The contract trusts Noren's relayer price signature, not a native Yahoo/Pyth proof. TEST stocks are not issuer shares. Human Meteor approval is manual, and Meteor can't sign gasless checkout yet. Private checkout is not built on NEAR. Mainnet funding via Intents is a dry quote only.

## X post draft

The human posts this with the video attached. Draft text: **237 characters**, within 280.

```text
keep your bitcoin. buy the thing. noren lets shoppers borrow against test BTC and TEST stocks, paid straight to the shop, on NEAR testnet. test tokens, public payments, no real shares. built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

attach: noren-near-film-x139.mp4 (2:19, free account) or noren-near-film-1.5x.mp4 (Premium)

## Before submission

- Nick fills the personal fields, confirms the project name and tracks, and replaces the README's other-projects placeholder with the names and links (or confirms none). Each independent entry must disclose the others; one person may enter at most two projects.
- Publish the repository with its MIT LICENSE before the deadline. The README describes the local NEAR-only demo. Its X post needs the demo video; screenshots alone do not satisfy the local-only rule.
- Recheck the live rules. Q-001 currently allows work since the Oct 19 announcement; this pack uses the requested stricter Nov 1 baseline and excludes earlier-chain work anyway.
- Submit once after Nick confirms the completed fields and consent. For an API submission, generate `requestId` once at submission time and reuse it on retries; it is an API field, not a human form field. Keep the personal payload out of git. Leave the form's hidden `website` spam trap empty.
- If a saved submission needs correction, use [request changes](https://nearhackathon.com/request-changes).
