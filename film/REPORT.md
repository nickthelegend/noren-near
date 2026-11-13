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

Reference review and current-UI before captures are in progress. No product change or new transaction has been made for this port yet.
