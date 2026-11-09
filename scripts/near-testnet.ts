// Deploys only on NEAR testnet; stores the signing key in gitignored .near-credentials/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, PublicKey, actions, nearToYocto, teraToGas, type KeyPairString } from "near-api-js";

const root = resolve(import.meta.dirname, "..");
if (existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));
const rpc = "https://test.rpc.fastnear.com";
const helper = process.env.NEAR_TESTNET_HELPER_URL ?? "https://helper.testnet.near.org/account";
const keyFile = resolve(root, ".near-credentials/testnet.json");
const wasm = resolve(root, "packages/contract/target/near/noren_credit.wasm");
if (!existsSync(wasm)) throw new Error("Build the contract wasm first");
mkdirSync(resolve(root, ".near-credentials"), { recursive: true, mode: 0o700 });
const steps: { name: string; hash: string; status: string; explorer: string }[] = [];
const out = resolve(root, "deployments/testnet-2026-11-09.json");
function record(accountId: string) {
  mkdirSync(resolve(root, "deployments"), { recursive: true });
  writeFileSync(out, JSON.stringify({ network: "testnet", rpc, ranAt: new Date().toISOString(), accountId,
    accountExplorer: `https://testnet.nearblocks.io/address/${accountId}`,
    contractWasmSha256: createHash("sha256").update(readFileSync(wasm)).digest("hex"), steps }, null, 2) + "\n");
}
let accountId: string; let secretKey: string;
if (existsSync(keyFile)) {
  ({ accountId, secretKey } = JSON.parse(readFileSync(keyFile, "utf8")) as { accountId: string; secretKey: string });
} else {
  const key = KeyPair.fromRandom("ed25519");
  const sponsorId = process.env.NEAR_TESTNET_SPONSOR_ACCOUNT;
  const sponsorKey = process.env.NEAR_TESTNET_SPONSOR_KEY;
  if ((sponsorId && !sponsorKey) || (!sponsorId && sponsorKey)) throw new Error("Setup required: NEAR_TESTNET_SPONSOR_ACCOUNT and NEAR_TESTNET_SPONSOR_KEY together");
  if (sponsorId && !sponsorId.endsWith(".testnet")) throw new Error("Testnet sponsor must end in .testnet");
  accountId = `noren-credit-${Date.now().toString(36)}.${sponsorId ?? "testnet"}`;
  secretKey = key.toString();
  if (sponsorId && sponsorKey) {
    const sponsor = new Account(sponsorId, new JsonRpcProvider({ url: rpc }), new KeyPairSigner(KeyPair.fromString(sponsorKey as KeyPairString)));
    const funding = await sponsor.signAndSendTransaction({ receiverId: accountId, actions: [
      actions.createAccount(), actions.transfer(nearToYocto("3")), actions.addFullAccessKey(PublicKey.fromString(key.getPublicKey().toString()))
    ], throwOnFailure: false, waitUntil: "FINAL" }) as unknown as { transaction: { hash: string }; status: { Failure?: unknown } };
    if (funding.status.Failure) throw new Error(`Sponsor transaction rejected: ${JSON.stringify(funding.status.Failure)}`);
    steps.push({ name: "sponsor creates testnet account", hash: funding.transaction.hash, status: "success",
      explorer: `https://testnet.nearblocks.io/txns/${funding.transaction.hash}` });
    record(accountId);
  } else {
    const response = await fetch(helper, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: key.getPublicKey().toString() }),
    });
    if (!response.ok) throw new Error(`Faucet HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  writeFileSync(keyFile, JSON.stringify({ accountId, secretKey }), { mode: 0o600 });
}
const signer = new Account(accountId, new JsonRpcProvider({ url: rpc }), new KeyPairSigner(KeyPair.fromString(secretKey as KeyPairString)));
async function send(name: string, receiverId: string, act: ReturnType<typeof actions.functionCall>[]) {
  const result = await signer.signAndSendTransaction({ receiverId, actions: act, throwOnFailure: false, waitUntil: "FINAL" }) as unknown as { transaction: { hash: string }; status: { Failure?: unknown } };
  const hash = result.transaction.hash;
  const status = result.status.Failure ? "rejected" : "success";
  steps.push({ name, hash, status, explorer: `https://testnet.nearblocks.io/txns/${hash}` });
  record(accountId);
  if (status === "rejected" && name !== "unconfirmed borrow rejected") throw new Error(`${name} rejected: ${JSON.stringify(result.status.Failure)}`);
  if (status !== "rejected" && name === "unconfirmed borrow rejected") throw new Error("Unconfirmed borrow was accepted");
}
const deploy = await signer.signAndSendTransaction({ receiverId: accountId, actions: [actions.deployContract(readFileSync(wasm)),
  actions.functionCall("new", { owner: accountId, oracle: "price-oracle-wrapper.testnet", yield_source: accountId, usdc: "usdc.fakes.testnet", apr_bps: 1000 }, teraToGas(30), 0n)],
  throwOnFailure: false, waitUntil: "FINAL" }) as unknown as { transaction: { hash: string }; status: { Failure?: unknown } };
if (deploy.status.Failure) throw new Error(`Deployment rejected: ${JSON.stringify(deploy.status.Failure)}`);
steps.push({ name: "deploy and initialize", hash: deploy.transaction.hash, status: "success", explorer: `https://testnet.nearblocks.io/txns/${deploy.transaction.hash}` });
record(accountId);
await send("configure wNEAR collateral", accountId, [actions.functionCall("configure_asset", { token: "wrap.testnet", decimals: 24, ltv_bps: 5000 }, teraToGas(30), 0n)]);
await send("unconfirmed borrow rejected", accountId, [actions.functionCall("borrow", { amount: "1000000", recipient: accountId }, teraToGas(50), 0n)]);
console.log(JSON.stringify({ accountId, steps, output: "deployments/testnet-2026-11-09.json" }, null, 2));
