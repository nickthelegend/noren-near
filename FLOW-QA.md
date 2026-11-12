# Full-flow QA — Noren on NEAR

## QA signer: real browser transactions (2026-11-11 UTC)

**PASS at 1440 × 900 and 375 × 900.** The unchanged browser controls connected the QA signer, deposited 0.0001 test WBTC, borrowed 0.01 test USDC directly to the shop, repaid 0.02 test USDC (excess refunded), and withdrew all collateral. Every action showed pending → FINAL and a NearBlocks receipt. The app position reflected the deposit, debt and restored zero-debt state. These are real browser-signed transactions, not transport fixtures or replayed receipts.

One manual check remains: a human signs in and approves through Meteor itself. QA signing validates the same app call path but does not certify Meteor's approval UI. Real yield and mainnet execution remain unfinished.

The successful run finalized eight browser transactions plus two Node-signed price refreshes. Price signatures and the relayer key stayed in Node; only the demo testnet signing key was injected into a local QA page. Both cycles restored Alice's original collateral balance and zero debt. The shop gained exactly 0.02 test USDC in the successful run.

| Width | Action | Real transaction (FINAL) |
| --- | --- | --- |
| 1440 | deposit (browser) | [AEmh2WSLEUaXYGCWfScawcoLjDQrhXNQJ8t2gEvJJfWw](https://testnet.nearblocks.io/txns/AEmh2WSLEUaXYGCWfScawcoLjDQrhXNQJ8t2gEvJJfWw) |
| 1440 | price (Node price relayer) | [AVdVdZqjruhr9XEJeUbr1Kon97vdABMEaupM7EynAj9w](https://testnet.nearblocks.io/txns/AVdVdZqjruhr9XEJeUbr1Kon97vdABMEaupM7EynAj9w) |
| 1440 | borrow (browser) | [5gdrLSwiHNGxY5aP1bbuUTGqUfn8Vw8LSRHFTU8bBiFc](https://testnet.nearblocks.io/txns/5gdrLSwiHNGxY5aP1bbuUTGqUfn8Vw8LSRHFTU8bBiFc) |
| 1440 | repay (browser) | [HaMKaXsceeYCPfy4PAkovojgrwoh5cfoyPvqHeZEQCaZ](https://testnet.nearblocks.io/txns/HaMKaXsceeYCPfy4PAkovojgrwoh5cfoyPvqHeZEQCaZ) |
| 1440 | withdraw (browser) | [6g1ZLC4sjRJbQX43kDnvYqTqd7BdoV2voZRi6WGx98PH](https://testnet.nearblocks.io/txns/6g1ZLC4sjRJbQX43kDnvYqTqd7BdoV2voZRi6WGx98PH) |
| 375 | deposit (browser) | [H4ipAeyjwkGgaSf8yimzU2y8eV36cxgpUVPHY6MWUFZ2](https://testnet.nearblocks.io/txns/H4ipAeyjwkGgaSf8yimzU2y8eV36cxgpUVPHY6MWUFZ2) |
| 375 | price (Node price relayer) | [EneAgxh6XgeMn9AUZpzda7edA5sQZ2e5NxNuDA7zKP6u](https://testnet.nearblocks.io/txns/EneAgxh6XgeMn9AUZpzda7edA5sQZ2e5NxNuDA7zKP6u) |
| 375 | borrow (browser) | [9ZVkBJWL2kTauiLRnvi9ZEggLKYTHmpEWQvnKsor1769](https://testnet.nearblocks.io/txns/9ZVkBJWL2kTauiLRnvi9ZEggLKYTHmpEWQvnKsor1769) |
| 375 | repay (browser) | [5aB7c7ZZv1xhoNLH9iV57B4qVK6PcsTC1fRqtmS44S9Z](https://testnet.nearblocks.io/txns/5aB7c7ZZv1xhoNLH9iV57B4qVK6PcsTC1fRqtmS44S9Z) |
| 375 | withdraw (browser) | [EQqVw6eiZHcPTbPhgYwmviL6jw6ezFyfUFdHr23KH1nj](https://testnet.nearblocks.io/txns/EQqVw6eiZHcPTbPhgYwmviL6jw6ezFyfUFdHr23KH1nj) |

Successful run spend: **0.0056031176347174005 testnet NEAR**. An initial diagnostic attempt finalized one desktop cycle, then failed a post-flow browser gate before its cause was recorded. Its five final hashes and **0.0028015588173587003 NEAR** spend remain in the ledger. The rerun added safe diagnostics and passed both sizes with zero page exceptions, console errors, HTTP errors, failed requests or horizontal overflow. Total for this QA signer task: **0.0084046764520761 NEAR**, below 0.3. The initial attempt's screenshots were superseded by the clean rerun; the table below links the successful run.

Public calls, hashes, fees, before/after balances, build audits and viewport results: [qa-browser-2026-11-11.json](deployments/qa-browser-2026-11-11.json). The runner retains conservative budget reservations for failed runs and uses verified finalized fees for successful runs across dated ledgers. No further transaction is authorized beyond the aggregate 0.3 NEAR cap.

### Before / after and real browser states

No JSX, CSS, fonts, colors, layout or artwork changed for the QA signer. The existing Meteor-labelled controls use the QA adapter only in a QA-mode build. Ordinary production still connects Meteor.

| State | Before: 1440 / 375 | After: 1440 / 375 |
| --- | --- | --- |
| Account connection | `before-account-1440.png` / `before-account-375.png` | `connected-1440.png` / `connected-375.png` |
| Credit position | `before-credit-1440.png` / `before-credit-375.png` | `position-deposited-1440.png` / `position-deposited-375.png` |
| Payment and receipt | `before-pay-1440.png` / `before-pay-375.png` | `borrow-final-1440.png` / `borrow-final-375.png` |

| Real browser state | Screenshots: 1440 / 375 |
| --- | --- |
| Deposit sheet | `deposit-1440.png` / `deposit-375.png` |
| Deposit pending | `deposit-pending-1440.png` / `deposit-pending-375.png` |
| Deposit final | `deposit-final-1440.png` / `deposit-final-375.png` |
| Position after deposit | `position-deposited-1440.png` / `position-deposited-375.png` |
| Shop payment pending | `borrow-pending-1440.png` / `borrow-pending-375.png` |
| Shop payment final | `borrow-final-1440.png` / `borrow-final-375.png` |
| Position after borrowing | `position-borrowed-1440.png` / `position-borrowed-375.png` |
| Repayment pending | `repay-pending-1440.png` / `repay-pending-375.png` |
| Repayment final | `repay-final-1440.png` / `repay-final-375.png` |
| Withdrawal pending | `withdraw-pending-1440.png` / `withdraw-pending-375.png` |
| Withdrawal final | `withdraw-final-1440.png` / `withdraw-final-375.png` |
| Final restored position | `position-restored-1440.png` / `position-restored-375.png` |
| Debt-free view | `debt-free-1440.png` / `debt-free-375.png` |

Screenshots were captured locally during QA and are not committed.

### Isolation, credentials and reproduction

- `pnpm test:e2e` builds ordinary production and a separate QA preview, then runs Chrome under the shared `withChromeLock`. This run used `pnpm test:e2e --skip-build` after the same production/QA builds were run separately. Ten unit tests passed (two QA guard tests plus eight shared credit-call/runtime tests).
- Ordinary production was tested with `VITE_QA_SIGNER=1` but without QA mode: all three markers `qa-signer`, `__NOREN_QA_SIGNER__` and `__norenQaAuthorize` were absent from its complete output. QA mode plus the flag includes the adapter. Both builds contain zero `Arc`, `Robinhood`, `CCTP` and `arc.io` matches.
- The QA adapter requires a loopback page, a named `.testnet` signer, the exact `https://test.rpc.fastnear.com` endpoint, allowlisted testnet receivers/methods and a Node budget authorization. It rejects non-testnet argument accounts and non-function-call actions. Unit tests cover these guards.
- Node reads the existing credential file by path and passes only the demo signer to `page.addInitScript`. The page consumes/deletes the injection and keeps the signer in memory. No key is placed in environment variables, URLs, logs, artifacts, browser storage or another file. Screenshots are refused if visible text contains the injected key. No trace, HAR, video or persistent context is recorded.
- Swap was checked before builds (above 500 MB). Previews used checked-free port 5300 on loopback, never 8787. Every launched browser and preview was closed. Future runs create a timestamped screenshot subdirectory to avoid overwriting evidence. See [TESTING.md](TESTING.md#real-browser-qa-signer-e2e) for prerequisites and commands.

## NEAR-only entry (2026-11-11)

Current verdict: the production entry opens the NEAR credit app. It cannot mount the inherited multi-chain product. Meteor testnet sign-in and deposit, borrow/pay, repay and withdraw are implemented. Real browser signing through the gated QA signer is now verified above; real yield and mainnet execution remain unfinished.

The earlier QA below is preserved as historical evidence. Its multi-chain routes and destination quote controls are no longer reachable in this build. It does not define the current route surface.

### Ordered current user flow

Screenshots are 1440 × 900 / 375 × 900. PASS applies only to the described verification.

| # | Action | Result | Reason | Screenshots: 1440 / 375 |
| --- | --- | --- | --- | --- |
| 1 | Open `/` or `#/` | **FIXED** | The default landing is the existing NEAR credit app, canonical URL `#/near/app`. | `after-root-1440.png` / `after-root-375.png` |
| 2 | Follow About the NEAR edition (`#/near`) | **FIXED** | Product explanation retains the any-chain vision, but exposes NEAR-only navigation and destinations. Mainnet/private execution is not claimed. | `after-landing-status-1440.png` / `after-landing-status-375.png` |
| 3 | Browse coins, How it works and proof; open transaction evidence | **FIXED** | Anchors exist and keep the route. Token catalog is filtered to NEAR-side representations; only configured test WBTC is accepted. NearBlocks links use recorded hashes. | `after-landing-status-1440.png` / `after-landing-status-375.png` |
| 4 | Read the credit limit, collateral, debt and activity | **PASS** | Live NEAR testnet views render. Stale signed prices are labelled; a loading price never claims borrowing is open. | `after-root-1440.png` / `after-root-375.png` |
| 5 | Use the account chip to read a demo or another account | **PASS** | The reader remains available alongside Meteor; connecting selects the wallet account and synchronizes the reader input. | `after-connected-1440.png` / `after-connected-375.png` |
| 6 | Read an account with no collateral | **PASS** | No collateral/debt is shown; the app does not fabricate a funded position. | `after-empty-position-1440.png` / `after-empty-position-375.png` |
| 7 | Connect the QA signer through the existing account control | **PASS** | Real testnet account connected in a QA build at both sizes. Standard production still uses Meteor; its human approval check is described above. | `connected-1440.png` / `connected-375.png` |
| 8 | Deposit → borrow and pay shop → repay → withdraw | **PASS** | Real browser-signed calls finalized at both sizes; receipts and position updates matched chain state. Example: [5gdrLSwiHNGxY5aP1bbuUTGqUfn8Vw8LSRHFTU8bBiFc](https://testnet.nearblocks.io/txns/5gdrLSwiHNGxY5aP1bbuUTGqUfn8Vw8LSRHFTU8bBiFc). Full hashes are in the QA signer section above. | `borrow-final-1440.png` / `borrow-final-375.png` |
| 9 | Verify the same calls with the demo signer by file path | **PASS** | The existing real testnet proof finalized all four actions plus the price refresh: shop +0.01 test USDC, debt 0, collateral restored. No further spending in this isolation pass. | `after-withdraw-final-1440.png` / `after-withdraw-final-375.png` |
| 10 | Enter invalid amounts/merchant; toggle Pay in 3 | **PASS** | Zero, more than six decimals, unsafe integers and malformed amounts disable payment. Invalid NEAR merchant disables it. Pay in 3 is a disabled scheduling preview. | `after-pay-preview-1440.png` / `after-pay-preview-375.png` |
| 11 | Open Debt-free (`#/near/app/melt`) | **PASS** | Live position and Rhea inputs drive a labelled projection; the empty harvest state explains the missing adapter. | `after-debt-free-1440.png` / `after-debt-free-375.png` |
| 12 | Harvest actual yield | **BLOCKED** | No real yield adapter or testnet source exists. Nothing is credited as earned yield. | `after-debt-free-1440.png` / `after-debt-free-375.png` |
| 13 | Open inherited or unknown route bookmarks | **FIXED** | All 24 tested variants redirect to `#/near/app`, including merchant, checkout, bridge, earn, borrow, credit, swap and transaction routes. None mounts inherited code or requests another-chain RPC. | `after-redirect-app-bridge-1440.png` / `after-redirect-app-bridge-375.png` |
| 14 | Read during an RPC outage or delayed price | **PASS** | Injected HTTP 503 shows the read failure; delayed price shows Reading the signed price. Normal route checks have no failed requests. | `after-rpc-error-1440.png` / `after-rpc-error-375.png` |

Screenshots were captured locally during QA and are not committed.

### Before / after: existing design retained

No CSS, fonts, colors, layout rules or artwork changed. Components, icons and ambient animation were extracted without changing their rendering. The route surface, destination choices, catalog data and factual copy changed as requested. The production build copies only the static assets used by these NEAR screens; inherited source remains in git.

| Surface | Before: 1440 / 375 | After: 1440 / 375 |
| --- | --- | --- |
| root | `before-root-1440.png` / `before-root-375.png` | `after-root-1440.png` / `after-root-375.png` |
| about | `before-about-1440.png` / `before-about-375.png` | `after-landing-status-1440.png` / `after-landing-status-375.png` |
| credit | `before-credit-1440.png` / `before-credit-375.png` | `after-root-1440.png` / `after-root-375.png` |
| pay | `before-pay-1440.png` / `before-pay-375.png` | `after-pay-1440.png` / `after-pay-375.png` |
| debt-free | `before-debt-free-1440.png` / `before-debt-free-375.png` | `after-debt-free-1440.png` / `after-debt-free-375.png` |
| bridge | `before-bridge-1440.png` / `before-bridge-375.png` | `after-redirect-app-bridge-1440.png` / `after-redirect-app-bridge-375.png` |
| landing-status | `before-landing-status-1440.png` / `before-landing-status-375.png` | `after-landing-status-1440.png` / `after-landing-status-375.png` |

Screenshots were captured locally during QA and are not committed.

### Wallet and failure evidence on the isolated build

Actual Meteor popup checks use its real testnet page. Financial state checks use a test-only Meteor communication/position fixture and replay FINAL receipts from the real shared-call proof. The harness rejects browser broadcasts and asserts `testnet` plus `credit.noren-near-mw9h22el.testnet`; there is no production test-wallet bypass.

| State | Screenshots: 1440 / 375 |
| --- | --- |
| Closed popup | `closed-1440.png` / `closed-375.png` |
| Blocked popup | `blocked-1440.png` / `blocked-375.png` |
| Deposit sheet | `after-deposit-1440.png` / `after-deposit-375.png` |
| Deposit pending | `after-deposit-pending-1440.png` / `after-deposit-pending-375.png` |
| Deposit final | `after-deposit-final-1440.png` / `after-deposit-final-375.png` |
| Shop payment final | `after-pay-final-1440.png` / `after-pay-final-375.png` |
| Repayment final | `after-repay-final-1440.png` / `after-repay-final-375.png` |
| Withdrawal final | `after-withdraw-final-1440.png` / `after-withdraw-final-375.png` |
| Stale price: refresh required | `after-stale-price-1440.png` / `after-stale-price-375.png` |
| Insufficient testnet NEAR | `after-insufficient-near-1440.png` / `after-insufficient-near-375.png` |
| Invalid amount | `after-invalid-amount-1440.png` / `after-invalid-amount-375.png` |
| Invalid merchant | `after-invalid-merchant-1440.png` / `after-invalid-merchant-375.png` |
| Price still loading | `after-price-loading-1440.png` / `after-price-loading-375.png` |

Screenshots were captured locally during QA and are not committed.

### Verification and bundle audit

- Production build/typecheck passed: `NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter @noren/web build`. Free swap was 1045 MB before both builds. Preview used checked-free port 5395; port 8787 was not used. The final build took about 1.5 seconds after typechecking.
- Eight shared credit-call/runtime tests passed. `pnpm near:wallet-cycle --dry` also passed without reading credentials or signing. Wallet versions and the patched SDK remain as documented below.
- Headless Playwright `channel: 'chrome'`, under the shared `withChromeLock`: 64 route/error captures and 26 wallet action/error captures at 1440/375, plus real popup checks and targeted catalog/price-loading checks. Normal route views had zero page exceptions, console errors, failed requests, forbidden-chain requests and horizontal overflow. The RPC-error case deliberately returned 503; its screenshot is not a successful network integration claim. Financial fixtures replay recorded receipts and are not a fresh on-chain payment.
- The 24 redirect inputs were empty hash, `/`, `/app`, `/credit`, `/app/home`, `/app/pay`, `/app/bridge`, `/app/earn`, `/app/credit`, `/app/borrow`, `/app/swap`, `/credit/reputation`, `/dashboard`, `/dashboard/balances`, `/dashboard/payments`, `/dashboard/links`, `/dashboard/developers`, `/dashboard/settings`, `/dashboard/onboard`, `/merchant`, `/pay/example`, `/tx/arc/0xabc`, `/unknown` and `/near/app/bridge`.
- Complete production output scanned literally, case-sensitively, including binary assets: **Arc = 0; Robinhood = 0; CCTP = 0; arc.io = 0**. The text scan `rg -n 'Arc|Robinhood|CCTP|arc\.io' packages/web/dist` also returned no matches. Inherited source and package dependencies remain in the repository; they are not imported by this entry. README names prior chains only in its Prior work disclosure.
- The live proof remains [deployments/wallet-cycle-2026-11-11.json](deployments/wallet-cycle-2026-11-11.json): **0.0028015588173587003 testnet NEAR**, below the 0.3 cap. No new transaction was needed for routing/catalog isolation. Demo-key files were passed by path, never printed.

Machine evidence and harnesses: `routes.json`, `flow.json`, `signin.json`, `status.json`, `bundle-audit.json`; `before.mjs`, `routes.mjs`, `flow.mjs`, `signin.mjs` and `status.mjs` are alongside them. All screenshots stay outside the repository. The preview and browser processes started for this pass were closed after verification.

Screenshots were captured locally during QA and are not committed.

## Historical QA before NEAR-only isolation (superseded)

The remainder records earlier runs, including routes now excluded from this entry. Refer to the current matrix above for judging.

Run: 2026-11-11. Branch: `near`. **Updated verdict: Meteor testnet signing and the credit actions are implemented. The shared browser call pipeline passed a real demo-key cycle; human Meteor approval remains manual.** The inherited Arc private checkout also passed on a local fork. This report does not certify unfinished cross-chain, yield or Robinhood features.

## Environment and method

- Production SDK/web builds passed. Served with `pnpm --filter @noren/web exec vite preview --host 127.0.0.1 --port 5395 --strictPort`. The port was checked with lsof first; port 8787 was never used.
- Checked `sysctl vm.swapusage` before builds. Free swap was above 500 MB on each check; no low-swap wait was required.
- Headless Playwright, `channel: 'chrome'`, at **1440 × 900** and **375 × 900**. Every browser launch was inside the requested shared `withChromeLock`; contexts/pages were sequential and closed in finally blocks.
- The baseline used the README's local NEAR routes. The inherited screens were additionally checked against `NOREN_DEV_ORIGINS=http://127.0.0.1:5395 pnpm dev:stack` (local Arc fork, merchant API and ASP). No mainnet transaction was signed.
- Normal NEAR views/quotes and the local checkout used real services/contracts. Fault checks explicitly injected HTTP 503/RPC errors or delayed real responses; they are not successful integration evidence.
- Captured screenshots, page exceptions, console errors, failed requests, response status failures, visible undefined/NaN, and document/body horizontal overflow. Raw machine records and browser scripts are in the evidence directory below. The interactive matrix additionally exercised the signed-in screens. API key values are redacted in screenshots and text logs.
- Only functional logic, factual copy and broken-state text wrapping changed. Fonts, colors, artwork and the approved component layouts were preserved. A mechanical detector found one pre-existing `transition: width` warning in styles.css, outside the changed wrapping rules; it was left alone.

## Ordered user flow

Screenshot columns link desktop / mobile captures. PASS applies to the action described, not an unexecuted payment branch.

| # | Action / route | Result | Evidence and reason | Screenshots: 1440 / 375 |
| --- | --- | --- | --- | --- |
| 1 | Land at `#/near` and understand the product | **FIXED** | The hero now distinguishes live testnet credit, cross-chain dry quotes and projected yield repayment. | `after-near-landing-1440.png` / `after-near-landing-375.png` |
| 2 | Browse Coins, How it works and Testnet proof | **PASS** | Landing anchors scroll within the NEAR page; they preserve the hash router. Public 1Click prices and contract reads rendered. | `after-near-coins-1440.png` / `after-near-coins-375.png` |
| 3 | Read the testnet cycle and open its evidence | **PASS** | Recorded deposit, price, payment, repay, withdrawal and rejected-attack cards link to their recorded NearBlocks hashes. | `after-near-proof-1440.png` / `after-near-proof-375.png` |
| 4 | Open the credit app at `#/near/app` | **PASS** | Bob’s collateral, debt, available credit and health are live contract views. A stale relayer price is explicitly labelled and borrowing is paused. | `after-near-credit-1440.png` / `after-near-credit-375.png` |
| 5 | Open the account picker and switch bob → alice | **FIXED** | The previous borrower’s balances are cleared immediately while the new position loads. The picker validates account characters. | `after-position-account-race-1440.png` / `after-position-account-race-375.png` |
| 6 | Read an empty position | **PASS** | An account without contract collateral shows no collateral/debt and the empty activity state. This is not a fabricated demo position. | `after-near-empty-1440.png` / `after-near-empty-375.png` |
| 7 | Connect a NEAR wallet | **FIXED** | The existing account chip connects Meteor on testnet. Real popup/open/closed/blocked checks passed; the protocol fixture checks the exact credit contract. Human sign-in approval is manual. | `signin-account-1440.png` / `signin-account-375.png` |
| 8 | Deposit, borrow/pay, repay and withdraw in the browser | **FIXED** | Existing controls now submit wallet-signed calls, wait for FINAL, handle rollbacks and link NearBlocks. UI state tests replay the real shared-call proof receipts; the separate demo-key script finalized the same calls on testnet. | `after-pay-final-1440.png` / `after-pay-final-375.png` |
| 9 | Run the live NEAR cycle through repository scripts | **PASS** | A new 0.0001 test WBTC deposit, signed price, 0.01 test USDC merchant borrow, full repayment and withdrawal all finalized. Alice ended debt-free with her original collateral balance restored. Exact hashes and spending are below. | `after-near-alice-1440.png` / `after-near-alice-375.png` |
| 10 | Get a Base quote at `#/near/app/pay` | **PASS** | A real dry quote returned amount out, cost and time. Sending remains disabled; no mainnet execution was attempted. | `after-near-base-quote-1440.png` / `after-near-base-quote-375.png` |
| 11 | Get an Arbitrum quote | **PASS** | The selected network and quoted network agree for a completed request. Sending remains disabled. | `after-near-arbitrum-quote-1440.png` / `after-near-arbitrum-quote-375.png` |
| 12 | Change the destination while a quote is pending | **FIXED** | A late Base response previously appeared after switching to Arbitrum. Changed inputs now invalidate pending results and their errors. | `after-quote-destination-race-1440.png` / `after-quote-destination-race-375.png` |
| 13 | Try invalid addresses and amounts; preview Pay in 3 | **FIXED** | Invalid addresses disable quoting. Very large amounts previously crashed React during BigInt conversion. Zero, extra decimal places, malformed and unsafe amounts are now disabled; 1.000001 USDC is accepted. The schedule is explicitly a preview. | `after-amount-overflow-1440.png` / `after-amount-overflow-375.png` |
| 14 | Open Debt-free at `#/near/app/melt` | **PASS** | The payoff date and curve are labelled Projection and depend on live position/rate inputs. | `after-near-debt-free-1440.png` / `after-near-debt-free-375.png` |
| 15 | Attempt a harvest | **BLOCKED** | No real yield adapter or testnet yield source exists. The Harvests card explains the blocker; no yield is credited. | `after-near-debt-free-1440.png` / `after-near-debt-free-375.png` |
| 16 | Change NEAR tab URLs and use browser navigation | **FIXED** | The active tab follows hash changes instead of continuing to show the previous view. | `after-near-hash-navigation-1440.png` / `after-near-hash-navigation-375.png` |
| 17 | Load Rhea/RPC error states | **FIXED** | Injected HTTP 503 and unknown-account RPC errors produce bounded recovery messages, not raw JSON. Failed rate reads show Unavailable instead of Reading forever. Service requests have a 15-second timeout. | `after-rpc-unavailable-1440.png` / `after-rpc-unavailable-375.png` |
| 18 | Follow Noren on Arc to `#/` | **BLOCKED** | The inherited landing renders and its links work. Its public Arc facts request intermittently receives HTTP 429 from rpc.testnet.arc.io. This is an external read dependency; success was not fabricated. | `after-arc-landing-1440.png` / `after-arc-landing-375.png` |
| 19 | Sign into inherited `#/app` | **PASS** | Use a test wallet works. The browser-wallet choice explains that no extension is installed. Email/wallet sign-in is a separate human/Privy path; it does not provide NEAR or Meteor signing. | `interactive-arc-signed-in-1440.png` / `interactive-arc-signed-in-375.png` |
| 20 | Open the inherited wallet/profile | **PASS** | The profile shows addresses and funding controls. The local Arc faucet actually funded the test wallet; screenshots contain no private keys. | `interactive-arc-faucet-funded-1440.png` / `interactive-arc-faucet-funded-375.png` |
| 21 | Browse inherited Home and Pay | **PASS** | Signed-in Home and Pay render their empty balances/activity/link states without exceptions or overflow. A real private invoice payment was completed below. | `interactive-arc-pay-1440.png` / `interactive-arc-pay-375.png` |
| 22 | Browse inherited Bridge | **BLOCKED** | The source-chain balance is zero and the action asks to fund the test key. No CCTP burn was sent. | `interactive-arc-bridge-1440.png` / `interactive-arc-bridge-375.png` |
| 23 | Browse inherited Earn, Credit and Borrow | **BLOCKED** | The minimal Arc stack has no Robinhood deposit vaults/credit contracts. Their setup states render. The warmed Robinhood snapshot is absent in this checkout and the main checkout; these actions require that fixture and dev:all. | `interactive-arc-earn-1440.png` / `interactive-arc-earn-375.png` |
| 24 | Browse inherited Swap | **BLOCKED** | The screen renders. A public-testnet swap was not sent from this fresh test key; funding the local Arc fork does not fund public Arc testnet. | `interactive-arc-swap-1440.png` / `interactive-arc-swap-375.png` |
| 25 | Open Merchant `#/dashboard` / `#/dashboard/onboard` | **PASS** | The first-run wizard offers a local test-wallet SIWE sign-in. Signing a login message sent no chain transaction. | `legacy-merchant-onboard-1440.png` / `legacy-merchant-onboard-375.png` |
| 26 | Sign in, name a business and choose payouts | **PASS** | Business and Payouts forms work; local store registration actually executed on the Arc fork. | `interactive-merchant-payouts-1440.png` / `interactive-merchant-payouts-375.png` |
| 27 | Create the store, first payment link and view API keys | **FIXED** | Store creation previously unmounted the wizard and lost the first-link/key steps. The wizard now remains open through link creation and the one-time key screen. Secret and publishable key values are redacted in evidence. | `interactive-merchant-first-link-1440.png` / `interactive-merchant-first-link-375.png` |
| 28 | Finish onboarding and open Merchant Home | **PASS** | The new store and invoice are selected after finishing the wizard. | `interactive-merchant-store-home-1440.png` / `interactive-merchant-store-home-375.png` |
| 29 | Open Balances, Payments and Payment links | **PASS** | All three routes render for the signed-in store, including zero balances and the newly created invoice/link. | `interactive-merchant-store-payments-1440.png` / `interactive-merchant-store-payments-375.png` |
| 30 | Open Developers, Webhooks, Events and Settings | **PASS** | All four routes render with the store session; empty webhook/event states and business-name form are reachable. No webhook was sent to a third party. | `interactive-merchant-store-developers-webhooks-1440.png` / `interactive-merchant-store-developers-webhooks-375.png` |
| 31 | Open a real checkout `#/pay/<invoiceId>` | **PASS** | The created invoice shows 0.10 USDC, the store name, description and supported methods. The UI makes private/public payment differences explicit. | `interactive-checkout-open-1440.png` / `interactive-checkout-open-375.png` |
| 32 | Fund, shield, approve and pay privately | **PASS** | The local faucet funded the browser wallet. A 20 USDC shield was approved by the ASP; a browser-generated proof paid the 0.10 USDC invoice. The result reported 1.24 s proving, 2.3 s click-to-paid and no payer address in the payment transaction. These are measurements from this local fork run. | `interactive-checkout-payment-result-1440.png` / `interactive-checkout-payment-result-375.png` |
| 33 | Open the successful receipt `#/tx/arc/<hash>` | **PASS** | The local receipt says Succeeded and decodes token transfers and the Paid event. The fork hash is not a public-chain transaction. | `interactive-receipt-success-1440.png` / `interactive-receipt-success-375.png` |
| 34 | Select Pay with USDC; stocks; credit; another-chain methods | **BLOCKED** | USDC method/insufficient-balance state was checked; only the private payment branch was executed. Stock/credit need the missing Robinhood stack; cross-chain execution needs funded source testnets. These branches are not claimed as end-to-end passes. | `interactive-checkout-usdc-1440.png` / `interactive-checkout-usdc-375.png` |
| 35 | Open missing or malformed invoice links | **FIXED** | A malformed invoice URL previously returned the landing page. It now reaches the existing checkout error screen. A missing valid-format invoice gives Invoice not found. | `after-checkout-invalid-1440.png` / `after-checkout-invalid-375.png` |
| 36 | Open missing/invalid receipt URLs | **PASS** | Missing receipts and invalid chain/hash values show the existing readable error states. | `after-receipt-invalid-1440.png` / `after-receipt-invalid-375.png` |
| 37 | Open aliases and unknown routes | **PASS** | `#/credit` aliases the inherited app; `#/merchant` aliases the dashboard. Unknown routes use the existing landing fallback; an unknown NEAR app suffix defaults to Credit. | `after-near-unknown-1440.png` / `after-near-unknown-375.png` |
| 38 | Lose the merchant API connection | **FIXED** | The existing setup instructions remain readable at 375 px instead of extending the page hundreds of pixels horizontally. This state is deliberately injected during the final check. | `after-checkout-server-unavailable-1440.png` / `after-checkout-server-unavailable-375.png` |

Screenshots were captured locally during QA and are not committed.

## Every remaining inherited route

The following named routes were also opened in the production build at both widths; the signed-in store matrix is separate from the first-run/signed-out matrix:

- **PASS** — `#/dashboard/balances`: `interactive-merchant-store-balances-1440.png` / `interactive-merchant-store-balances-375.png`.
- **PASS** — `#/dashboard/payments`: `interactive-merchant-store-payments-1440.png` / `interactive-merchant-store-payments-375.png`.
- **PASS** — `#/dashboard/links`: `interactive-merchant-store-links-1440.png` / `interactive-merchant-store-links-375.png`.
- **PASS** — `#/dashboard/developers`: `interactive-merchant-store-developers-1440.png` / `interactive-merchant-store-developers-375.png`.
- **PASS** — `#/dashboard/developers/webhooks`: `interactive-merchant-store-developers-webhooks-1440.png` / `interactive-merchant-store-developers-webhooks-375.png`.
- **PASS** — `#/dashboard/developers/events`: `interactive-merchant-store-developers-events-1440.png` / `interactive-merchant-store-developers-events-375.png`.
- **PASS** — `#/dashboard/settings`: `interactive-merchant-store-settings-1440.png` / `interactive-merchant-store-settings-375.png`.
- **PASS** — unknown payment detail `#/dashboard/payments/<unknown id>` renders the existing empty/not-found state: `legacy-merchant-payments-0x1111111111111111111111111111111111111111111111111111111111111111-1440.png` / `legacy-merchant-payments-0x1111111111111111111111111111111111111111111111111111111111111111-375.png`.
- **BLOCKED** — `#/app/borrow` and `#/app/credit` require the missing Robinhood fixture: `interactive-arc-borrow-1440.png` / `interactive-arc-borrow-375.png`; `interactive-arc-credit-1440.png` / `interactive-arc-credit-375.png`.

Screenshots were captured locally during QA and are not committed.

## NEAR testnet transaction evidence and budget

Used the existing credential **file path** through the repository's `near-lib.ts` helpers and `scripts/live-borrow.mjs --account alice --amount 0.01 --relay --key-file <path>`. No key contents were printed. Preflight found alice had about 0.116 testnet NEAR, zero debt and enough test tokens. The attached-gas upper bound was 0.035 NEAR. Five transactions finalized; measured account balance decrease was **0.00280153134 NEAR**, below the **0.3 NEAR** total QA cap. No other NEAR writes were performed in that original QA pass; the later Meteor shared-call proof is recorded separately below.

- **PASS** — QA: alice deposits 0.0001 test WBTC: [D4ZdhXDAd9FV67uCuhpQdHNS2nqk1KcTKw41RAq46Rwa](https://testnet.nearblocks.io/txns/D4ZdhXDAd9FV67uCuhpQdHNS2nqk1KcTKw41RAq46Rwa).
- **PASS** — live borrow: relayer posts signed BTC-USD price (pnpm near:borrow --relay): [DPYwHxMN64QUnju26QmEBjmc5uYRnWGMJnJBDfAwgWtr](https://testnet.nearblocks.io/txns/DPYwHxMN64QUnju26QmEBjmc5uYRnWGMJnJBDfAwgWtr).
- **PASS** — live borrow: alice pays shop 0.01 test USDC on credit (pnpm near:borrow): [C8Xixu2fA6QKcxLdgC67ZtoqhTxm3gjRjQKeihYTu4yr](https://testnet.nearblocks.io/txns/C8Xixu2fA6QKcxLdgC67ZtoqhTxm3gjRjQKeihYTu4yr).
- **PASS** — QA: alice repays the 0.01 test USDC draw (excess refunded): [Ej4oS6mnqseWan1T2LUpQWVaM2wVQwXX75uQy9uY41os](https://testnet.nearblocks.io/txns/Ej4oS6mnqseWan1T2LUpQWVaM2wVQwXX75uQy9uY41os).
- **PASS** — QA: alice withdraws 0.0001 test WBTC: [DTjayqRHKZAWaGhYumTVXousbyq7qYuvP5CN5vKanNYX](https://testnet.nearblocks.io/txns/DTjayqRHKZAWaGhYumTVXousbyq7qYuvP5CN5vKanNYX).

Postconditions: alice debt 0, no collateral remaining in the credit contract, her test WBTC balance restored, merchant balance increased by exactly 0.01 test USDC. The public testnet deployment JSON records these hashes. The live signed price naturally expires after 90 seconds; a relayer must refresh it before later borrowing. This QA did not install a keeper.

## Fixes and before/after screenshots

Each UI fix has both viewport sizes before and after. Live account values and time labels may differ across captures. Secret values on the one-time merchant key screen are masked.

| Functional issue | Before: 1440 / 375 | After: 1440 / 375 |
| --- | --- | --- |
| Hash navigation showed the previous tab | `before-near-hash-navigation-1440.png` / `before-near-hash-navigation-375.png` | `after-near-hash-navigation-1440.png` / `after-near-hash-navigation-375.png` |
| Unsafe amounts blanked the app | `before-amount-overflow-1440.png` / `before-amount-overflow-375.png` | `after-amount-overflow-1440.png` / `after-amount-overflow-375.png` |
| Changing account showed another borrower’s balances | `before-position-account-race-1440.png` / `before-position-account-race-375.png` | `after-position-account-race-1440.png` / `after-position-account-race-375.png` |
| Pending quotes survived a destination change | `before-quote-destination-race-1440.png` / `before-quote-destination-race-375.png` | `after-quote-destination-race-1440.png` / `after-quote-destination-race-375.png` |
| RPC errors exposed raw JSON | `before-rpc-unavailable-1440.png` / `before-rpc-unavailable-375.png` | `after-rpc-unavailable-1440.png` / `after-rpc-unavailable-375.png` |
| Failed rates left the projection Reading | `before-rates-unavailable-1440.png` / `before-rates-unavailable-375.png` | `after-rates-unavailable-1440.png` / `after-rates-unavailable-375.png` |
| Mobile setup instructions overflowed | `before-merchant-home-1440.png` / `before-merchant-home-375.png` | `after-merchant-home-1440.png` / `after-merchant-home-375.png` |
| Feature copy contradicted implemented scope | `before-near-landing-1440.png` / `before-near-landing-375.png` | `after-near-landing-1440.png` / `after-near-landing-375.png` |
| Store creation skipped link/key onboarding steps | `interactive-merchant-registration-blocked-1440.png` / `interactive-merchant-registration-blocked-375.png` | `interactive-merchant-first-link-1440.png` / `interactive-merchant-first-link-375.png` |
| Malformed invoice route fell back to the landing | `before-checkout-invalid-1440.png` / `before-checkout-invalid-375.png` | `after-checkout-invalid-1440.png` / `after-checkout-invalid-375.png` |

The API/CORS fix separately allows explicitly configured **loopback** preview origins in development and SIWE; unconfigured and remote origins remain denied. Actual preflight checks accepted 127.0.0.1:5395 and rejected localhost.evil.test:5395. The browser store sign-in then succeeded on the preview origin.

Screenshots were captured locally during QA and are not committed.

## Validation, limits and remaining blockers

- **PASS** — SDK build and 6 SDK tests, including readable RPC/HTTP/network failures.
- **PASS** — 15 targeted server/auth/origin tests. These are this run's tests, separate from historical counts in TESTING.md.
- **PASS** — production web typecheck/build after the fixes; normal NEAR screens and the signed-in private checkout have no unhandled page exceptions or horizontal overflow at either width.
- **PASS** — amount regression checks cover zero, malformed decimals, more than six decimals, an extremely large number, and valid micro-USDC precision. Delayed real-response tests cover account changes and destination changes.
- **Expected failures** — deliberate missing invoice requests return HTTP 404; deliberate offline/503 cases display recovery states. A landing video request is aborted when navigating away. The public Arc provider returned HTTP 429 during the broad inherited-route scan; those failures are retained in the machine records. They are not zero-error passes for that external live panel.
- **FIXED: NEAR wallet UI.** See the Meteor addition below. Human approval cannot be automated; the real popup path and shared on-chain call pipeline have separate evidence.
- **BLOCKED: mainnet-only cross-chain execution and real yield.** No deposit attribution/payout/yield adapter or running keeper exists. A funded account alone does not supply the missing code. No mainnet action was attempted.
- **BLOCKED: inherited Robinhood and unfunded external testnets.** Snapshot-backed Earn/Borrow/Credit, stocks, Pay in 3 and cross-chain settlement need the full missing fixture/stack. Source-chain CCTP and public Arc swaps need test funds on their respective networks. Screens/setup messages were checked; those transfers were not sent.
- Human email/extension/World ID sign-ins were not automated. No third-party webhook or social post was sent. No repository push or .loom edit occurred.

## Evidence location and cleanup

All screenshots and raw JSON: `noren-near`. Browser harnesses: `walk.mjs`, `edges.mjs`, `legacy.mjs`, `interact.mjs`, `merchant.mjs`, `checkout.mjs`, `final-checks.mjs`. Budget/postconditions: `onchain.json`.

Cleanup is recorded after the last verification: the preview, local Arc fork, merchant API and ASP started for this run are stopped; pre-existing services are left alone.

Screenshots were captured locally during QA and are not committed.

## Meteor wallet addition (2026-11-11)

Steps 7-8 are implemented. No fonts, colors, art, CSS layout or approved page structure were changed. Meteor lives in the existing account sheet; Bring coins opens a sheet using Noren's existing form/button/receipt classes. Repay and withdraw are in the account sheet; the existing NEAR pay button signs borrow-to-merchant. Base/Arbitrum remain dry quotes. Noren's merchant privacy, credit-against-coins and any-chain positioning is unchanged. NEAR credit positions/payments remain public.

### What was actually verified

- **Real Meteor popup:** Wallet Selector core and Meteor module 10.1.4 opened `wallet.meteorwallet.app/connect/testnet/login` at 1440/375. Closing the popup and blocking window.open produced actionable messages. A human login was not performed or claimed.
- **Protocol/UI checks:** a test-only Meteor communication fixture returns the demo identity, asserts network=testnet and the exact `credit.noren-near-mw9h22el.testnet` sign-in contract, and replays FINAL receipts from the real proof. Position fixtures permit each state to be inspected. Browser broadcast RPC methods are explicitly forbidden by this harness. These screenshots demonstrate wiring/states, not a human-signed wallet transfer.
- **Real chain proof:** `pnpm near:wallet-cycle --key-file .near-credentials/testnet.json` imports the SAME credit runtime and call builders as the browser. It signs with the demo key loaded only by file path. Deposit, borrow-to-shop, repay and withdraw all finalized, plus a fresh signed price. Alice ended debt-free with her test WBTC restored; the shop received exactly 0.01 test USDC. Current-run spend: **0.00280155882 NEAR**, below 0.3. Raw calls and postconditions: [wallet-cycle proof](deployments/wallet-cycle-2026-11-11.json).
- **Safety tests:** 8 unit tests cover precision/U128 limits, exact token receivers, withdrawal to the signer, testnet-only minting, actual popup strings, stale prices, FINAL polling and rollback/refund handling. Production typecheck/build passed. A pnpm patch removes the pinned SDK's generated access-key console log from both module entry points.
- **Dependencies:** core/meteor-wallet 10.1.4; isolated near-api-js 6.2.5 and @near-js/utils 2.5.1 via the same package-extension mechanism as Kotoba 6aba9ce. Noren's root scripts remain on near-api-js 7.3.1.

### Wallet evidence (desktop / mobile)

| State | Screenshots 1440 / 375 |
| --- | --- |
| Account sheet before change | `before-account-1440.png` / `before-account-375.png` |
| Credit page before change | `before-credit-1440.png` / `before-credit-375.png` |
| NEAR pay before change | `before-pay-1440.png` / `before-pay-375.png` |
| Actual Meteor connection control | `signin-account-1440.png` / `signin-account-375.png` |
| Closed popup | `closed-1440.png` / `closed-375.png` |
| Blocked popup | `blocked-1440.png` / `blocked-375.png` |
| Connected account and actions (protocol fixture) | `after-connected-1440.png` / `after-connected-375.png` |
| Deposit form (protocol fixture) | `after-deposit-1440.png` / `after-deposit-375.png` |
| Pending deposit (receipt replay) | `after-deposit-pending-1440.png` / `after-deposit-pending-375.png` |
| Final deposit (receipt replay) | `after-deposit-final-1440.png` / `after-deposit-final-375.png` |
| Borrow and merchant payment (receipt replay) | `after-pay-final-1440.png` / `after-pay-final-375.png` |
| Repayment (receipt replay) | `after-repay-final-1440.png` / `after-repay-final-375.png` |
| Withdrawal (receipt replay) | `after-withdraw-final-1440.png` / `after-withdraw-final-375.png` |
| Stale-price rejection | `after-stale-price-1440.png` / `after-stale-price-375.png` |
| Insufficient NEAR rejection | `after-insufficient-near-1440.png` / `after-insufficient-near-375.png` |

Browser harnesses/metadata are next to these screenshots (`baseline.mjs`, `signin.mjs`, `flow.mjs`, `signin.json`, `flow.json`), under the requested shared Chrome lock. Fixtures stay outside the product/repo; there is no production test-wallet bypass.

- **FINAL deposit:** [E9qUeuzRDSWCt2AjWLmw63BwWZo1PTrw3nKCC1FWPLoi](https://testnet.nearblocks.io/txns/E9qUeuzRDSWCt2AjWLmw63BwWZo1PTrw3nKCC1FWPLoi).
- **FINAL borrow:** [BK8YbY2iq9NVgt1C6peSsGbFKP3QxkSo97ondDcK41yZ](https://testnet.nearblocks.io/txns/BK8YbY2iq9NVgt1C6peSsGbFKP3QxkSo97ondDcK41yZ).
- **FINAL repay:** [GcHa5CT9yYA7dHVfcN1LyEAxyeYeUpWGnk2sxb9Xkj4Q](https://testnet.nearblocks.io/txns/GcHa5CT9yYA7dHVfcN1LyEAxyeYeUpWGnk2sxb9Xkj4Q).
- **FINAL withdraw:** [8FBuYRoDqAwiCWm3T6K5i31o5hTBXnvNQJu8LEJD5bXR](https://testnet.nearblocks.io/txns/8FBuYRoDqAwiCWm3T6K5i31o5hTBXnvNQJu8LEJD5bXR).

Still unfinished: real yield harvesting, mainnet cross-chain execution, and the inherited missing Robinhood fixture. The testnet relayer must refresh prices before borrowing; a stale price stops submission and explains `pnpm near:relay`. Approval may be requested for storage/token calls; previously authorized credit calls may sign without another popup.

The final account-input regression also passed at both sizes: after connecting, the reader input follows the active wallet instead of retaining the earlier demo address. Before/after captures: `before-account-sync-1440.png` / `before-account-sync-375.png` / `after-connected-1440.png` / `after-connected-375.png`.

Screenshots were captured locally during QA and are not committed.

