# ETHGlobal product port to NEAR — execution report

Started 2026-11-13 on branch `near`. No hosting, push or other-repo changes are authorized. The requested ETHGlobal components/styles/art are the design reference for this port; this is an explicit product restoration, not a new visual direction. Existing NEAR credit functionality must remain available.

## Reference reviewed

- ETHGlobal showcase: https://ethglobal.com/showcase/noren-bh8wb . It describes the earlier multi-chain implementation; its claims are not NEAR evidence.
- Final source: `_wt/noren-final3` (release3); merchant README: `_wt/noren-arcjudges`.
- Submitted 239.6-second film: `_wt/noren-film/film/renders/noren-demo-v9.mp4`. Read SPEC, README, edit/edl.py and renders/READ-ALONG-v9.md; inspected the full film through scene-aware frames plus additional credit/payment cue frames. Reference extraction is saved outside the repo under videos/noren-near/film-ethglobal/reference.
- Structure: problem/website → Merchant sign-in/business/payouts/link/API keys → Aubelle product/bag/four ways to pay → app → stock collateral/credit/installments/repayment → merchant receipt → close. The NEAR version will lead with stocks and replace all historical chain footage with fresh NEAR-testnet takes.
- Hosted reference sites are being opened read-only. Browser evidence is under orchestration/shots/noren-near/ethglobal-port. No reference-site writes.

## Safer decisions (Nick asleep; no approval questions)

- Keep the deployed credit account, existing stock tokens, signed-price relayer, wallet and test signer working. Reuse presentation code and ideas only; do not import retired chain packages or RPC clients.
- NEAR payments and positions are public. Retain the original private-payment choice only with an explicit unavailable reason. The opening must qualify the privacy aspiration rather than claim unbuilt NEAR privacy.
- Native test stocks are not real shares. Stocks-as-collateral does not sell them; direct pay-with-stock is a separate, explicitly labelled sale into test USDC if a real verified NEAR execution is built.
- Store metadata, API keys and links may be local merchant-service data; never call a local record an on-chain registration. Wallet authentication must be cryptographically verified. API secrets are shown once and stored hashed; film redacts them.
- Pay in 3 must distinguish scheduling from money actually paid. Existing contract draws installments when due; the merchant is not paid the whole bill by merely creating a schedule.
- Yield, private checkout and real mainnet Intents funding remain unavailable unless newly built and verified. No invented APY, privacy, reputation tier or price timestamp.
- Original film music/fonts/art can be reused with their attribution. New voice is Kokoro af_heart. All current renders are preserved in versions before replacement. An independent judge review may score below 9; never inflate a score to satisfy a target.

## Execution status

Reference review and before captures are complete. The native buyer upgrade, merchant service and original UI port are implemented; validation below distinguishes live evidence from remaining market-window work.

## Native stock buyer and v3 credit upgrade

Four Rust unit tests passed, including exact v2 state migration; the six existing sandbox scenarios passed, and the new seventh sandbox scenario passed after correcting its time advance (200 blocks did not expire 90 seconds). It verifies real stock-for-USDC payment, separate LP funds, full stock refund on merchant transfer failure, insufficient funds/slippage and stale-price refunds. The first deployed upgrade rolled back with LackBalanceForState; recorded reserve transfers between owned accounts allowed the atomic migration to finalize. Owner mint finalized; an SDK prepaid-gas balance check stopped the next funding call before broadcast. A temporary owned-account gas reserve then funded the separate buyer with 500 test USDC and was returned. No helper funding or mainnet transaction. Every successful and failed on-chain action is in deployments/market-*.json. Existing alice/bob collateral, credit limits, pending locks and LP pool matched across the upgrade.

Merchant backend: five trust-boundary tests pass, including actual NEP-413 signature verification, one-use challenges, session/key scoping, invoice-bound final receipts and duplicate-hash rejection. Local store metadata is not called on-chain registration. Product UI is still being wired before it becomes the default route.

## Original surface port and current validation

Restored the original landing, Noren Merchant onboarding/dashboard, Aubelle catalogue/bag/checkout/order screens, and six-tab Noren app. Reused the original components, fonts, styles and artwork. Retired chain screenshots were replaced with original brand illustrations labelled as illustrations; no unrelated-chain package or RPC client was reintroduced. Existing native credit views remain under `#/near/app`. Merchant records are local service data; sign-in uses verified NEP-413 wallet messages. Private checkout, signed webhooks, fiat conversion and stock yield are explicitly unavailable.

The first mobile pass exposed header overflow; shortening the existing network label fixed it. The signed-in regression captured 78 screens at 1440/375 with no page exceptions or horizontal overflow. It verified actual wallet signatures, store/link creation, one-time API keys (masked), key revocation, all merchant and customer tabs, Aubelle bag-to-checkout, and invalid/empty states. Real browser USDC payments finalized at both widths and appeared in merchant receipts: GTaxgYXVYPB8LTTy71q7smuing2EZZokiXsTz8tnBQJs and DbvFvmcxx7fx4Cq8SfFS6wyfcpA828ZJMbaSdQhxEvnC. Evidence: deployments/ethglobal-browser-2026-11-13T07-03-34-762Z.json. Screenshots were captured locally during QA and are not committed.

Executed tests: 4 Rust unit + 7 sandbox + 12 SDK + 2 equity-source + 2 live read-only MCP + 20 web/merchant = 47 passed. Frozen install, web typecheck and production build pass. Ordinary production excludes all three QA signer markers even with the flag set; production JS/CSS/HTML contain no whole-word Arc, Robinhood, CCTP, CCIP or NYSE mentions. Static host rewrites are ready; publishing still needs Nick's approval, an approved persistent API host, VITE_NOREN_API and exact NOREN_WEB_ORIGIN. Nothing hosted or pushed.

Remaining: new app stock-sale/credit/installment verification and fresh film transactions must wait for US market opening at 14:30 UTC Nov13. No closed-market price is re-timestamped. Current film preserved as versions/v2-stocks.mp4 and v2-stocks-share.mp4; native af_heart narration prepared, HyperFrames edit not rendered yet.

### Payment-link boundary and film rehearsal

Guarded non-finite amount previews so a 400-digit input cannot crash the form; Create link stays disabled. Corrected inherited description copy: anyone with the payment link can read its off-chain description. Before/after form captures exist at both widths; the focused after pass captured 36 screens with no transactions or page exceptions. A source-only filming rehearsal captured the actual website, merchant setup, Aubelle bag/checkout and app with zero chain transactions. No stock payment was fabricated while the market was closed. The full live shoot still waits for 14:30 UTC.

### Real buyer receipt compatibility

A real browser test-WBTC sale completed through the same native buyer while equities were closed: 1,455 token units sold, 1.000273 test USDC sent to the shop. The browser could not initially reconcile it because the deployed public test USDC emits legacy transfer/memo logs instead of NEP-297 JSON. Recovered the existing hash from public NEAR blocks, verified FINAL execution and the exact invoice memo, and reconciled that same payment without another transaction: GhYfbiud2tVrkgpmyY6sPRKVJFNqYojFDpDCJ2VemHwA. The price post was DgaJsnCN3dBe3ejMSFKJJsh8vdzr42QuZ3SYPWXNGgh7. Both are retained in the failed browser run plus the explicit receipt-recovery supplement; the failed record is not rewritten as a pass.

The service now accepts either modern token events or the exact legacy transfer+memo pair from the hardcoded test-USDC executor. A regression rejects a mismatched memo. Nine merchant-service tests pass, including exact-origin NEP-413 challenges. UI refresh/retry protection is being tested separately with real payments and an explicitly injected receipt-network failure, never a fake successful chain result. The filmed TEST-Tesla sale still waits for market opening.

### Native WBTC checkout and refresh-safe receipts

The complete WBTC checkout/retry run passed at 1440 and 375 with 88 captures and four real transactions (two fresh signed BTC quotes and two buyer payments). An explicitly injected receipt-network failure was followed by a page refresh and verification of the existing hash; no second chain payment was submitted. Public pending-receipt data now survives refresh, new payment buttons stay disabled during recovery, and integer conversion dust cannot display a negative remaining balance. The merchant sees the actual amount received. Cost for this run: 0.0026758509673244 testnet NEAR. Evidence: deployments/ethglobal-browser-2026-11-13T07-59-17-568Z.json.

New payment hashes: 7p4nf873QF5KqLqrKcuCB3djtzcQndE5NDhkiSJwjvmF (1440), EVWmUtG1WmFmgtUGTV7duDjp8jbxd1j41UdXkhNKDpaZ (375). These are QA evidence, not footage from the pending live stock shoot. No mainnet execution, hosting or push. Current executed total is 50 passing tests: 4 Rust unit,7 sandbox,12 SDK,2 equity-source,2 live read-only MCP,23 web/merchant.
