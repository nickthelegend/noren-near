// Deploys Noren credit on NEAR testnet and runs the credit lifecycle with real signed transactions:
// test collateral in, LP pool, relayer price, borrow, pay a merchant, repay, withdraw. Every tx hash is
// written to deployments/testnet.json. Re-running skips what already exists.
//
// Funding: a new root account comes from the NEAR testnet account helper. If it answers 429, set
// NEAR_TESTNET_SPONSOR_FILE to a JSON credentials file ({id,key} or {accounts:[{id,key}]}) and
// NEAR_TESTNET_SPONSOR_ID to the funder; at most NEAR_TESTNET_SPONSOR_NEAR (default 4) is taken from it.
//
// Tokens: collateral is wbtc.fakes.testnet and the pool asset is usdc.fakes.testnet, Ref Finance's public
// testnet NEP-141 tokens (open mint, no value). They stand in for bridged BTC (nep141:btc.omft.near) and
// NEAR USDC on mainnet. Using them keeps the deployment inside a 4 NEAR testnet budget.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KeyPair, PublicKey, actions, nearToYocto, teraToGas } from "near-api-js";
import {
  accountFor, explorerAccount, fetchBtcSpot, loadCreds, loadDeployment, provider, relayerPublicKeyBase64, root,
  saveCreds, saveDeployment, send, sha256File, signPrice, view, type Creds, type Deployment,
} from "./near-lib";

if (existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));
const CREDIT_WASM = resolve(root, "packages/contract/target/near/noren_credit.wasm");
for (const w of [CREDIT_WASM]) if (!existsSync(w)) throw new Error(`Build first (pnpm near:build): missing ${w}`);
const TGAS = (n: number) => teraToGas(n);
const call = (method: string, args: object, gas = 30, deposit = 0n) => actions.functionCall(method, args, TGAS(gas), deposit);

async function exists(id: string) {
  try { await provider.viewAccount({ accountId: id }); return true; } catch { return false; }
}

// ------------------------------------------------------------------ 1. root account
let creds = loadCreds();
if (!creds) {
  const rootKey = KeyPair.fromRandom("ed25519");
  const rootId = `noren-near-${Date.now().toString(36)}.testnet`;
  const res = await fetch("https://helper.nearprotocol.com/account", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: rootId, newAccountPublicKey: rootKey.getPublicKey().toString() }) });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 120);
    const file = process.env.NEAR_TESTNET_SPONSOR_FILE, sponsorId = process.env.NEAR_TESTNET_SPONSOR_ID;
    if (!file || !sponsorId) throw new Error(`Account helper HTTP ${res.status} (${text}). Setup required: NEAR_TESTNET_SPONSOR_FILE and NEAR_TESTNET_SPONSOR_ID, or retry later.`);
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { id?: string; key?: string; accounts?: { id: string; key: string }[] };
    const entry = (parsed.accounts ?? [parsed as { id: string; key: string }]).find(a => a.id === sponsorId);
    if (!entry) throw new Error(`Sponsor ${sponsorId} not found in NEAR_TESTNET_SPONSOR_FILE`);
    const amount = process.env.NEAR_TESTNET_SPONSOR_NEAR ?? "4";
    if (Number(amount) > 4) throw new Error("Take at most 4 NEAR from a shared sponsor");
    const sponsor = accountFor(entry.id, entry.key);
    const r = await sponsor.signAndSendTransaction({ receiverId: "testnet", waitUntil: "FINAL", throwOnFailure: true,
      actions: [actions.functionCall("create_account", { new_account_id: rootId, new_public_key: rootKey.getPublicKey().toString() }, TGAS(100), nearToYocto(amount as `${number}`))] }) as unknown as { transaction: { hash: string } };
    console.log(`root funded by sponsor: https://testnet.nearblocks.io/txns/${r.transaction.hash}`);
  }
  creds = { rootId, rootKey: rootKey.toString(), subKey: KeyPair.fromRandom("ed25519").toString(), relayerKey: KeyPair.fromRandom("ed25519").toString() };
  saveCreds(creds);
}
const c: Creds = creds;
const R = c.rootId;
const accountIds = { credit: `credit.${R}`, alice: `alice.${R}`, bob: `bob.${R}`, shop: `shop.${R}` };
const ids = { ...accountIds, tbtc: "wbtc.fakes.testnet", tusdc: "usdc.fakes.testnet" };
const d: Deployment = loadDeployment() ?? { network: "testnet", rpc: "https://test.rpc.fastnear.com", updatedAt: "", root: R,
  accounts: { root: R, ...ids }, contracts: {}, steps: [], blocked: [] };
d.relayerPublicKey = relayerPublicKeyBase64(c.relayerKey);
saveDeployment(d);
const rootAcc = accountFor(R, c.rootKey);
const sub = (id: string) => accountFor(id, c.subKey);
const subPk = PublicKey.fromString(KeyPair.fromString(c.subKey as never).getPublicKey().toString());
const done = (step: string) => d.steps.some(s => s.step === step && (s.status === "success" || step.startsWith("attack")));

// ------------------------------------------------------------------ 2. sub-accounts
const funding: Record<keyof typeof accountIds, string> = { credit: "3.45", alice: "0.12", bob: "0.12", shop: "0.05" };
for (const [name, id] of Object.entries(accountIds) as [keyof typeof accountIds, string][]) {
  if (await exists(id)) continue;
  await send(d, rootAcc, `create ${name} account`, id, [actions.createAccount(), actions.transfer(nearToYocto(funding[name] as `${number}`)), actions.addFullAccessKey(subPk)]);
}

// ------------------------------------------------------------------ 3. contracts
async function deploy(name: "credit", wasm: string, init: object) {
  const id = ids[name];
  d.contracts[name] = { account: id, wasmSha256: sha256File(wasm), bytes: readFileSync(wasm).length };
  if (done(`deploy ${name}`)) return;
  await send(d, sub(id), `deploy ${name}`, id, [actions.deployContract(readFileSync(wasm)), call("new", init, 100)], { method: "new" });
}
await deploy("credit", CREDIT_WASM, { owner: R, oracle: "price-oracle-wrapper.testnet", yield_source: R, usdc: ids.tusdc,
  apr_bps: 1000, relayer_key: relayerPublicKeyBase64(c.relayerKey) });

const once = async (step: string, fn: () => Promise<unknown>) => { if (!done(step)) await fn(); };
await once("configure test WBTC collateral (50% LTV)", () => send(d, rootAcc, "configure test WBTC collateral (50% LTV)", ids.credit,
  [call("configure_asset", { token: ids.tbtc, decimals: 8, ltv_bps: 5000 })], { method: "configure_asset" }));
const STORAGE = 1_250_000_000_000_000_000_000n;
for (const t of ["tbtc", "tusdc"] as const) {
  const step = `register storage on ${ids[t]}`;
  await once(step, () => send(d, rootAcc, step, ids[t], [ids.credit, ids.alice, ids.bob, ids.shop, R].map(a => call("storage_deposit", { account_id: a, registration_only: true }, 10, STORAGE)), { method: "storage_deposit" }));
}
await once("mint test collateral: 0.01 test WBTC to alice, 0.005 to bob", () => send(d, rootAcc, "mint test collateral: 0.01 test WBTC to alice, 0.005 to bob", ids.tbtc,
  [call("mint", { account_id: ids.alice, amount: "1000000" }, 20), call("mint", { account_id: ids.bob, amount: "500000" }, 20)],
  { method: "mint", note: "Public testnet WBTC (wbtc.fakes.testnet, open mint, no value) standing in for bridged BTC (nep141:btc.omft.near on mainnet)" }));
await once("mint 1000 test USDC to the LP (root)", () => send(d, rootAcc, "mint 1000 test USDC to the LP (root)", ids.tusdc,
  [call("mint", { account_id: R, amount: "1000000000" }, 20)], { method: "mint" }));
const ftCall = (receiver: string, amount: string, msg: object) => call("ft_transfer_call", { receiver_id: receiver, amount, msg: JSON.stringify(msg) }, 60, 1n);
await once("LP supplies 500 test USDC to the pool", () => send(d, rootAcc, "LP supplies 500 test USDC to the pool", ids.tusdc,
  [ftCall(ids.credit, "500000000", { kind: "pool" })], { method: "ft_transfer_call" }));

// ------------------------------------------------------------------ 4. lifecycle
const alice = sub(ids.alice), bob = sub(ids.bob);
await once("alice deposits 0.01 test WBTC collateral", () => send(d, alice, "alice deposits 0.01 test WBTC collateral", ids.tbtc,
  [ftCall(ids.credit, "1000000", { kind: "collateral" })], { method: "ft_transfer_call" }));
await once("bob deposits 0.005 test WBTC collateral", () => send(d, bob, "bob deposits 0.005 test WBTC collateral", ids.tbtc,
  [ftCall(ids.credit, "500000", { kind: "collateral" })], { method: "ft_transfer_call" }));
await once("attack: forged ft_on_transfer collateral rejected", () => send(d, rootAcc, "attack: forged ft_on_transfer collateral rejected", ids.credit,
  [call("ft_on_transfer", { sender_id: ids.shop, amount: "100000000", msg: JSON.stringify({ kind: "collateral" }) })], { expect: "rejected", method: "ft_on_transfer" }));

async function postPrice(step: string) {
  const spot = await fetchBtcSpot();
  const signed = signPrice(c.relayerKey, ids.credit, ids.tbtc, spot.priceUsd6, spot.timestampNs);
  const { message: _m, ...args } = signed;
  await send(d, alice, step, ids.credit, [call("post_signed_price", args)], { method: "post_signed_price",
    note: `relayer price (testnet): Coinbase BTC-USD ${spot.raw.price} at ${spot.raw.time}` });
}
await once("attack: borrow before any price rejected", () => send(d, alice, "attack: borrow before any price rejected", ids.credit,
  [call("borrow", { amount: "1000000", recipient: ids.alice }, 100)], { expect: "rejected", method: "borrow" }));
await once("attack: forged relayer signature rejected", async () => {
  const spot = await fetchBtcSpot();
  const forged = signPrice(KeyPair.fromRandom("ed25519").toString(), ids.credit, ids.tbtc, spot.priceUsd6 * 10n, spot.timestampNs);
  const { message: _m, ...args } = forged;
  await send(d, rootAcc, "attack: forged relayer signature rejected", ids.credit, [call("post_signed_price", args)], { expect: "rejected", method: "post_signed_price" });
});

if (!done("alice pays shop 25 test USDC on credit (borrow → merchant)")) {
  await postPrice("relayer posts signed BTC-USD price");
  await send(d, alice, "alice pays shop 25 test USDC on credit (borrow → merchant)", ids.credit,
    [call("borrow", { amount: "25000000", recipient: ids.shop }, 80)], { method: "borrow" });
}
if (!done("bob pays shop 12 test USDC on credit (open position)")) {
  await postPrice("relayer posts signed BTC-USD price (bob)");
  await send(d, bob, "bob pays shop 12 test USDC on credit (open position)", ids.credit,
    [call("borrow", { amount: "12000000", recipient: ids.shop }, 80)], { method: "borrow" });
}

if (!d.blocked.some(b => b.step === "harvest")) d.blocked.push({ step: "harvest",
  reason: "No real yield source exists on NEAR testnet for this collateral: Rhea lending and NEAR Intents (yield → USDC) are mainnet-only. No yield is credited; the harvester path (Deposit::Yield from the configured yield source) is covered only by the sandbox tests." });

await once("faucet: alice receives 27 test USDC to repay (test token)", () => send(d, rootAcc, "faucet: alice receives 27 test USDC to repay (test token)", ids.tusdc,
  [call("mint", { account_id: ids.alice, amount: "27000000" }, 20)], { method: "mint", note: "Test faucet. On mainnet the borrower brings USDC from any chain via 1Click." }));
await once("alice repays in full (overpayment refunded)", () => send(d, alice, "alice repays in full (overpayment refunded)", ids.tusdc,
  [ftCall(ids.credit, "27000000", { kind: "repay" })], { method: "ft_transfer_call" }));
const debt = await view<string>(ids.credit, "debt", { borrower: ids.alice });
if (debt !== "0") throw new Error(`Repay left debt ${debt}`);
await once("alice withdraws 0.01 test WBTC collateral", () => send(d, alice, "alice withdraws 0.01 test WBTC collateral", ids.credit,
  [call("withdraw", { token: ids.tbtc, amount: "1000000", recipient: ids.alice }, 80)], { method: "withdraw" }));
const back = await view<string>(ids.tbtc, "ft_balance_of", { account_id: ids.alice });
if (back !== "1000000") throw new Error(`alice test WBTC after withdraw: ${back}`);
saveDeployment(d);
console.log(JSON.stringify({ root: explorerAccount(R), credit: ids.credit, steps: d.steps.length, blocked: d.blocked.map(b => b.step) }, null, 2));
