// One live borrow on NEAR testnet, in one command: check the signed BTC price is fresh (or post one with
// --relay), show the position, draw a small amount of test USDC on credit paid straight to the shop, wait
// for finality, show the position again and the NearBlocks links. Output is short and aligned for filming.
//
//   pnpm near:borrow                       borrow 1 test USDC as bob, pay shop (fails if the price is stale)
//   pnpm near:borrow --relay               post a fresh signed Coinbase price first if it is stale
//   pnpm near:borrow --dry                 print the plan; nothing is signed or sent
//   options: --account bob|alice|<id>  --amount 1  --to <account>  --key-file <path>
//
// Keys: --key-file (default .near-credentials/testnet.json, gitignored) is read in code only and never
// printed. It may be Noren's deploy credentials ({rootId, rootKey, subKey, relayerKey}) or a near-cli key
// file ({account_id, private_key}); --relay needs the relayer key, so only the Noren file can relay.
// Every sent transaction is appended to deployments/testnet-2026-11-09.json, like pnpm near:relay does.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KeyPair, actions, teraToGas } from "near-api-js";
import {
  RPC, accountFor, credsFile, explorerAccount, explorerTx, fetchBtcSpot, loadDeployment, saveDeployment, signPrice, view,
} from "./near-lib.ts";

const PRICE_AGE_S = 90;          // the contract's limit (PRICE_AGE in packages/contract/src/lib.rs)
const SAFE_AGE_S = 75;           // leave room for the borrow to land after the check
const MAX_DEMO_USDC = 25;        // a demo guard against typos, not a contract rule
const MIN_GAS_NEAR = 0.01;

// ------------------------------------------------------------------ output
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint("32"), yellow = paint("33"), red = paint("31"), bold = paint("1"), dim = paint("2");
const out = (s = "") => console.log(s);
const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, "").length;
const row = (label, value, note = "") => out(`   ${label}${" ".repeat(Math.max(1, 13 - visible(label)))}${value}${note ? `  ${note}` : ""}`);
const head = (n, title) => { out(); out(`${bold(String(n))}  ${bold(title)}`); };
const fail = (reason, hint) => {
  out(); out(`${red("FAILED")}  ${reason}`); if (hint) out(`        ${hint}`); out(); process.exit(1);
};

const usd = (v6, w = 10) => (Number(BigInt(v6)) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(w);
const btc = (sats) => (Number(BigInt(sats)) / 1e8).toFixed(8);
const health = (bps) => (bps == null ? "no debt" : `${(Number(BigInt(bps)) / 10_000).toFixed(2)}×`);
const ago = (s) => (s < 120 ? `${Math.round(s)} s ago` : s < 7200 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`);
const short = (h) => `${h.slice(0, 10)}…`;

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) fail(`--${name} needs a value`);
  return v;
};
const known = new Set(["dry", "relay", "account", "amount", "to", "key-file", "help"]);
for (const a of argv) if (a.startsWith("--") && !known.has(a.slice(2))) fail(`Unknown option ${a}`, "Options: --dry --relay --account --amount --to --key-file");
if (flag("help")) { out(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(0, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(0); }

const DRY = flag("dry"), RELAY = flag("relay");
const d = loadDeployment();
if (!d) fail("Setup required: deployments/testnet-2026-11-09.json is missing", "Run pnpm near:testnet once to deploy the contract.");
const credit = d.accounts.credit, tbtc = d.accounts.tbtc, tusdc = d.accounts.tusdc;
const named = { alice: d.accounts.alice, bob: d.accounts.bob, shop: d.accounts.shop };
const borrower = named[opt("account", "bob")] ?? opt("account", "bob");
const recipient = named[opt("to", "shop")] ?? opt("to", "shop");
const amountText = opt("amount", "1");
if (!/^\d+(\.\d{1,6})?$/.test(amountText) || Number(amountText) <= 0) fail(`--amount ${amountText} is not a positive USDC amount (up to 6 decimals)`);
if (Number(amountText) > MAX_DEMO_USDC) fail(`--amount ${amountText} is over this script's ${MAX_DEMO_USDC} test USDC demo limit`);
const [whole, frac = ""] = amountText.split(".");
const amount6 = BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));

// ------------------------------------------------------------------ key file (read here, never printed)
const keyPath = resolve(opt("key-file", credsFile));
if (!existsSync(keyPath)) fail(`Setup required: key file not found at ${keyPath}`, "Pass --key-file <path> to a funded demo account's credentials.");
let signingKey, relayerKey;
{
  let parsed;
  try { parsed = JSON.parse(readFileSync(keyPath, "utf8")); } catch { fail(`Key file ${keyPath} is not valid JSON`); }
  if (parsed.subKey && parsed.rootId) {
    if (borrower === parsed.rootId) signingKey = parsed.rootKey;
    else if (borrower.endsWith(`.${parsed.rootId}`)) signingKey = parsed.subKey;
    relayerKey = parsed.relayerKey;
  } else if (parsed.account_id && parsed.private_key) {
    if (parsed.account_id === borrower) signingKey = parsed.private_key;
  }
  if (!signingKey) fail(`Key file ${keyPath} holds no key for ${borrower}`);
}
let publicKey;
try { publicKey = KeyPair.fromString(signingKey).getPublicKey().toString(); } catch { fail(`Key file ${keyPath} holds a key that does not parse as an ed25519 key`); }

async function rpc(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "noren", method, params }) });
  if (!res.ok) throw new Error(`NEAR RPC HTTP ${res.status} (${RPC})`);
  const json = await res.json();
  if (json.error) throw new Error(`NEAR RPC: ${json.error.cause?.name ?? json.error.name ?? "error"} ${JSON.stringify(json.error.data ?? json.error.message ?? "").slice(0, 160)}`);
  if (json.result?.error) throw new Error(`NEAR RPC: ${json.result.error}`.slice(0, 200));
  return json.result;
}

// ------------------------------------------------------------------ sending
const PANICS = {
  ERR_STALE_PRICE: "the BTC price is older than 90 s (run pnpm near:relay, or pass --relay)",
  ERR_LTV: "this would go over the credit limit (50% of the collateral's value)",
  ERR_LIQUIDITY: "the pool does not hold that much test USDC",
  ERR_PENDING: "an earlier borrow or withdrawal by this account is still settling",
  ERR_SIGNATURE: "the price signature does not match the contract's relayer key",
  ERR_PRICE_REPLAY: "a newer price is already on-chain",
  ERR_NO_RELAYER: "the contract has no relayer key",
};
function reasonOf(failure) {
  const text = JSON.stringify(failure);
  const code = Object.keys(PANICS).find((k) => text.includes(k));
  if (code) return `${code}: ${PANICS[code]}`;
  const panic = text.match(/Smart contract panicked: ([^"\\]+)/)?.[1];
  return panic ?? text.slice(0, 240);
}
/** Signs one transaction, waits for FINAL, appends it to the deployment record, and returns the outcome. */
async function sendTx(step, method, receiverId, acts, note) {
  const signer = accountFor(borrower, signingKey);
  const t0 = Date.now();
  let r;
  try {
    r = await signer.signAndSendTransaction({ receiverId, actions: acts, throwOnFailure: false, waitUntil: "FINAL" });
  } catch (e) {
    fail(`${method} was not confirmed: ${String(e?.message ?? e).split("\n")[0].slice(0, 200)}`, `Check ${explorerAccount(borrower)} before retrying.`);
  }
  const hash = r.transaction.hash;
  const failedReceipt = r.receipts_outcome?.find((o) => o.outcome?.status?.Failure);
  const value = r.status.SuccessValue != null ? Buffer.from(r.status.SuccessValue, "base64").toString() : null;
  // borrow returns its callback's result: false means the USDC transfer failed and the debt was rolled back.
  const ok = !r.status.Failure && (method !== "borrow" || value === "true");
  d.steps.push({ step, account: borrower, method, hash, status: ok ? "success" : "rejected", explorer: explorerTx(hash), note });
  saveDeployment(d);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!ok) {
    row(red("rejected"), explorerTx(hash));
    fail(reasonOf(r.status.Failure ?? failedReceipt?.outcome?.status?.Failure ?? `callback returned ${value}`));
  }
  row(green("ok"), `final in ${secs} s`);
  row("tx", explorerTx(hash));
  return hash;
}

// ------------------------------------------------------------------ reads
const readAsset = async () => {
  const a = (await view(credit, "assets")).find((x) => x.token === tbtc);
  if (!a) fail(`The contract has no ${tbtc} collateral configured`);
  return { ...a, ageS: a.price_at_ns === "0" ? Infinity : (Date.now() * 1e6 - Number(a.price_at_ns)) / 1e9 };
};
const readState = async () => {
  const [p, shop] = await Promise.all([view(credit, "position", { borrower }), view(tusdc, "ft_balance_of", { account_id: recipient })]);
  return { p, shop };
};
const priceRow = (a, note) => row("BTC-USD", `${usd(a.price_usd6, 10)} USD`, note);

// ================================================================== run
try {
  out();
  out(`${bold("Noren")} · one live borrow on NEAR testnet${DRY ? `  ${yellow("(dry run: nothing is sent)")}` : ""}`);
  out();
  row("Borrower", borrower);
  row("Pay to", recipient);
  row("Amount", `${usd(amount6, 0)} test USDC`);
  row("Contract", credit);

  const [acct, key, storage] = await Promise.all([
    rpc("query", { request_type: "view_account", finality: "final", account_id: borrower }),
    rpc("query", { request_type: "view_access_key", finality: "final", account_id: borrower, public_key: publicKey }).catch(() => null),
    view(tusdc, "storage_balance_of", { account_id: recipient }),
  ]);
  if (!key) fail(`The key in ${keyPath} is not an access key on ${borrower}`);
  if (key.permission !== "FullAccess" && key.permission?.FunctionCall?.receiver_id !== credit) fail(`The key in ${keyPath} cannot call ${credit}`);
  const gasNear = Number(BigInt(acct.amount) / 10n ** 18n) / 1e6;
  row("Gas balance", `${gasNear.toFixed(4)} NEAR`, gasNear < MIN_GAS_NEAR ? red(`need ≥ ${MIN_GAS_NEAR} NEAR`) : "");
  if (gasNear < MIN_GAS_NEAR) fail(`BLOCKED: ${borrower} holds ${gasNear.toFixed(4)} NEAR; it needs at least ${MIN_GAS_NEAR} testnet NEAR for gas`);
  if (!storage) fail(`${recipient} is not registered on ${tusdc}, so it cannot receive test USDC`, `Register it with storage_deposit on ${tusdc} first.`);

  // ---------------------------------------------------------------- 1. price
  head(1, "Price check");
  let asset = await readAsset();
  const fresh = asset.price_fresh && asset.ageS <= SAFE_AGE_S;
  priceRow(asset, `signed ${ago(asset.ageS)}  ${fresh ? green("FRESH") : yellow("STALE")}`);
  let relayHash = null;
  if (!fresh) {
    if (!RELAY && !DRY) fail(`The signed BTC price is ${ago(asset.ageS).replace(" ago", "")} old; borrowing needs one under ${PRICE_AGE_S} s`, "Run pnpm near:relay first, or run pnpm near:borrow --relay.");
    if (!relayerKey) fail(`--relay needs the relayer key, which is only in Noren's .near-credentials/testnet.json`);
    const spot = await fetchBtcSpot();
    const { message: _m, ...args } = signPrice(relayerKey, credit, tbtc, spot.priceUsd6, spot.timestampNs);
    const at = spot.raw.time.replace("T", " ").replace(/\.\d+Z$/, " UTC");
    row("Coinbase", `${usd(spot.priceUsd6, 10)} USD`, `traded ${at}`);
    if (DRY) {
      row(dim("would send"), `post_signed_price  signed by the relayer key, sent by ${borrower.split(".")[0]}`);
    } else {
      out(`   ${dim("posting the signed price, waiting for finality…")}`);
      relayHash = await sendTx("live borrow: relayer posts signed BTC-USD price (pnpm near:borrow --relay)", "post_signed_price", credit,
        [actions.functionCall("post_signed_price", args, teraToGas(30), 0n)], `relayer price (testnet): Coinbase BTC-USD ${spot.raw.price} at ${spot.raw.time}`);
      asset = await readAsset();
      priceRow(asset, `signed ${ago(Math.max(0, asset.ageS))}  ${asset.price_fresh ? green("FRESH") : red("STILL STALE")}`);
      if (!asset.price_fresh) fail("The price posted but the contract still reports it stale");
    }
  }

  // ---------------------------------------------------------------- 2. position before
  head(2, "Position before");
  const before = await readState();
  const col = before.p.collateral.find((c) => c.token === tbtc);
  row("Collateral", `${btc(col?.amount ?? 0)} test WBTC`, `$${usd(before.p.collateral_usd6, 0)}`);
  row("Credit limit", `${usd(before.p.credit_limit_usd6)} USDC`, "50% of collateral");
  row("Debt", `${usd(before.p.debt_usd6)} USDC`, `${before.p.apr_bps / 100}% APR`);
  row("Available", `${usd(before.p.available_usd6)} USDC`);
  row("Health", `${health(before.p.health_bps).padStart(10)}`, "1.00× = liquidatable");
  if (before.p.pending) fail(`${borrower} has a borrow or withdrawal still settling (ERR_PENDING)`, "Wait a few seconds and run again.");
  if (amount6 > BigInt(before.p.available_usd6)) fail(`${usd(amount6, 0)} USDC is more than the ${usd(before.p.available_usd6, 0)} USDC available`);

  // ---------------------------------------------------------------- 3. borrow
  head(3, `Borrow ${usd(amount6, 0)} test USDC, paid to ${recipient.split(".")[0]}`);
  const args = { amount: amount6.toString(), recipient };
  if (DRY) {
    row(dim("would send"), `borrow ${JSON.stringify(args)}`);
    row("", `to ${credit}, 80 TGas, signed by ${borrower}`);
    out();
    out(`${yellow("Dry run")}  nothing was signed or sent. Run without --dry to borrow.`);
    out();
    process.exit(0);
  }
  out(`   ${dim("borrow → contract pays the shop, waiting for finality…")}`);
  const borrowHash = await sendTx(`live borrow: ${borrower.split(".")[0]} pays ${recipient.split(".")[0]} ${amountText} test USDC on credit (pnpm near:borrow)`, "borrow", credit,
    [actions.functionCall("borrow", args, teraToGas(80), 0n)], `One live borrow from scripts/live-borrow.mjs at ${new Date().toISOString()}`);

  // ---------------------------------------------------------------- 4. position after
  head(4, "Position after");
  const after = await readState();
  const arrow = (a, b, unit) => `${usd(a)} → ${usd(b, 7)} ${unit}`;
  row("Debt", arrow(before.p.debt_usd6, after.p.debt_usd6, "USDC"));
  row("Available", arrow(before.p.available_usd6, after.p.available_usd6, "USDC"));
  row("Health", `${health(before.p.health_bps).padStart(10)} → ${health(after.p.health_bps).padStart(7)}`);
  const got = BigInt(after.shop) - BigInt(before.shop);
  row("Shop balance", arrow(before.shop, after.shop, "test USDC"), green(`+${usd(got, 0)}`));
  if (got !== amount6) fail(`The shop's balance moved by ${usd(got, 0)}, expected ${usd(amount6, 0)} (another payment may have landed at the same time)`);

  // ---------------------------------------------------------------- links
  out();
  out(bold("On NearBlocks (testnet)"));
  if (relayHash) row("Price", explorerTx(relayHash));
  row("Borrow", explorerTx(borrowHash));
  out();
  out(`${green("Done.")} ${relayHash ? "Two transactions" : "One transaction"}, final on NEAR testnet.`);
  out(dim("Recorded in deployments/testnet-2026-11-09.json"));
  out();
} catch (e) {
  fail(String(e?.message ?? e).split("\n")[0].slice(0, 240));
}
