# Noren 3D object kit (NEAR edition)

Single lacquered objects for the NEAR landing and credit app: feature tiles, card headers, how-it-works steps, empty,
setup-required, receipt (success, pending, error) states and the debt-free projection. The approved layout, fonts,
copy and the navy credit-limit card are unchanged; the objects are additions in space the layout already had.

- **Material:** glossy aizome-indigo lacquer, hard and mirror-smooth like urushi lacquerware, with kaki enamel inlay
  details. No metal chrome, no brushed silver, no candy plastic.
- **Palette (from `packages/web/src/app/app.css`):** main aizome indigo `#1c2a5e` with `#2c3d7c` on the curves
  (`--nk-ai`, `--nk-ai-2`), accent kaki persimmon `#d9772f` (`--nk-kaki`), rim light periwinkle `#7fa8ff` (the
  landing's `--glow`). On the night sections an object sits on a soft `#7fa8ff` radial light.
- **Face:** none. Noren is credit and payments, so every object is the object alone.
- **Background:** transparent (no ground shadow), trimmed to the object and padded to a square, webp at 640 px.
- **Subjects:** the noren-curtain shop stall (hero), credit card, BTC collateral coin with a padlock, receipt with a
  check stamp, health gauge, price tag with a wax seal (the signed price), desk calendar with three dots (Pay in 3,
  debt-free date), hourglass (the debt melting over time), shield with a keyhole (connect a wallet), empty coin tray,
  check badge (success), warning sign (error, blocked), rosette medal (badge candidate), split noren curtain (logo
  mark candidate).

Style line used in every prompt:

> Glossy deep aizome-indigo lacquered enamel 3D render: hard, mirror-smooth lacquer like Japanese urushi
> lacquerware, deep navy-indigo #1c2a5e body with lighter indigo #2c3d7c on the curves, kaki persimmon-orange #d9772f
> enamel details and thin inlay lines, and a soft periwinkle #7fa8ff rim light, soft studio lighting, crisp
> reflections, rounded bevelled edges, gentle toy-like proportions, no face, no eyes, centred single object,
> transparent background (no background, no ground shadow), square 1024x1024, no text, no letters, no numbers, no
> logos.

## Where each object is used

| Object | File | Used in |
|---|---|---|
| Shop stall | `noren-3d-stall.webp` | Landing closing call ("Run the cycle yourself"); app Pay anyone card header |
| Credit card | `noren-3d-card.webp` | App tile "Pay anyone"; landing step 03 |
| BTC coin | `noren-3d-btc-coin.webp` | App tile "Bring coins"; landing step 01 |
| Receipt | `noren-3d-receipt.webp` | App tile "Explorer" |
| Health gauge | `noren-3d-gauge.webp` | App "How much of your coin is spoken for" header; landing step 02 |
| Price tag | `noren-3d-price-tag.webp` | App "The contract" card header (signed BTC price) |
| Calendar | `noren-3d-calendar.webp` | App tile "Debt-free date"; debt-free projection date; landing "Debt-free on" card |
| Hourglass | `noren-3d-hourglass.webp` | Landing step 04; receipt while pending on NEAR testnet |
| Shield | `noren-3d-shield.webp` | Action sheet before a wallet is connected; receipt while waiting for Meteor; landing NEAR features header |
| Empty tray | `noren-3d-empty.webp` | Activity with nothing recorded for the account |
| Success badge | `noren-3d-success.webp` | Receipt when the action is final on NEAR testnet |
| Warning sign | `noren-3d-warning.webp` | Receipt when an action fails; blocked Harvests card |
| Medal | `noren-3d-medal.webp` | Generated as a badge candidate; not placed |
| Noren curtain | `noren-3d-mark.webp` | Logo mark candidate; not placed (the existing logo stays) |

Objects float 4 px over 6 s and stand still under `prefers-reduced-motion`. Each `<img>` has a fixed width and height
and alt text (empty inside the feature tiles, whose labels already name the action). The Vite plugin in
`packages/web/vite.config.ts` emits `public/art/3d/*.webp`, because this entry does not copy the public folder.

3D art generated with ChatGPT.
