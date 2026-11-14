// Shared NEAR testnet helpers for the deploy, lifecycle and relayer scripts.
// Keys live in the gitignored .near-credentials/ and are read here only; nothing prints them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, type KeyPairString } from "near-api-js";

export const root = resolve(import.meta.dirname, "..");
/** NEAR testnet RPC; NEAR_RPC may name another public testnet endpoint. */
export const RPC = process.env.NEAR_RPC ?? "https://test.rpc.fastnear.com";
export const provider = new JsonRpcProvider({ url: RPC });
export const credsDir = resolve(root, ".near-credentials");
export const credsFile = resolve(credsDir, "testnet.json");
export const deploymentFile = resolve(root, "deployments/testnet-2026-11-09.json");
export const explorerTx = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const explorerAccount = (id: string) => `https://testnet.nearblocks.io/address/${id}`;

export type Creds = { rootId: string; rootKey: string; subKey: string; relayerKey: string };
export function loadCreds(): Creds | null {
  return existsSync(credsFile) ? JSON.parse(readFileSync(credsFile, "utf8")) as Creds : null;
}
export function saveCreds(c: Creds) {
  mkdirSync(credsDir, { recursive: true, mode: 0o700 });
  writeFileSync(credsFile, JSON.stringify(c), { mode: 0o600 });
}
export function accountFor(id: string, key: string) {
  return new Account(id, provider, new KeyPairSigner(KeyPair.fromString(key as KeyPairString)));
}

export type Step = { step: string; account: string; method?: string; hash: string; status: "success" | "rejected"; explorer: string; note?: string };
export type Deployment = {
  network: "testnet"; rpc: string; updatedAt: string; root: string;
  accounts: Record<string, string>; contracts: Record<string, { account: string; wasmSha256: string; bytes: number }>;
  relayerPublicKey?: string; steps: Step[]; blocked: { step: string; reason: string }[];
};
export function loadDeployment(): Deployment | null {
  return existsSync(deploymentFile) ? JSON.parse(readFileSync(deploymentFile, "utf8")) as Deployment : null;
}
export function saveDeployment(d: Deployment) {
  mkdirSync(resolve(root, "deployments"), { recursive: true });
  d.updatedAt = new Date().toISOString();
  writeFileSync(deploymentFile, JSON.stringify(d, null, 2) + "\n");
}
export const sha256File = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

type TxResult = { transaction: { hash: string }; status: { Failure?: unknown; SuccessValue?: string } };
/** Sends one transaction, records it, and throws (loudly) unless the outcome matches `expect`. */
export async function send(d: Deployment, signer: Account, step: string, receiverId: string, acts: Parameters<Account["signAndSendTransaction"]>[0]["actions"],
  opts: { expect?: "success" | "rejected"; method?: string; note?: string } = {}) {
  const expect = opts.expect ?? "success";
  const r = await signer.signAndSendTransaction({ receiverId, actions: acts, throwOnFailure: false, waitUntil: "FINAL" }) as unknown as TxResult;
  const status = r.status.Failure ? "rejected" : "success";
  d.steps.push({ step, account: signer.accountId, method: opts.method, hash: r.transaction.hash, status, explorer: explorerTx(r.transaction.hash), note: opts.note });
  saveDeployment(d);
  console.log(`${status === expect ? "ok " : "BAD"} ${step}  ${explorerTx(r.transaction.hash)}`);
  if (status !== expect) throw new Error(`${step}: expected ${expect}, got ${status}: ${JSON.stringify(r.status.Failure ?? r.status).slice(0, 400)}`);
  return r;
}

export async function view<T>(contractId: string, method: string, args: object = {}): Promise<T> {
  const body = { jsonrpc: "2.0", id: "noren", method: "query", params: { request_type: "call_function", finality: "final",
    account_id: contractId, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } };
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json() as { error?: unknown; result?: { result?: number[]; error?: string } };
  if (json.error || json.result?.error) throw new Error(`${method}: ${JSON.stringify(json.error ?? json.result?.error).slice(0, 300)}`);
  return JSON.parse(Buffer.from(json.result!.result!).toString()) as T;
}

/** Public BTC-USD spot from Coinbase Exchange, with the exchange's own trade timestamp. */
export const PRICE_SOURCE = "https://api.exchange.coinbase.com/products/BTC-USD/ticker";
export async function fetchBtcSpot(): Promise<{ priceUsd6: bigint; timestampNs: bigint; raw: { price: string; time: string } }> {
  const res = await fetch(PRICE_SOURCE, { headers: { "user-agent": "noren-near-relayer" } });
  if (!res.ok) throw new Error(`Coinbase ticker HTTP ${res.status}`);
  const t = await res.json() as { price?: string; time?: string };
  if (!t.price || !t.time || !/^\d+(\.\d+)?$/.test(t.price)) throw new Error("Coinbase ticker returned no price/time");
  const [whole, frac = ""] = t.price.split(".");
  const priceUsd6 = BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
  return { priceUsd6, timestampNs: BigInt(Date.parse(t.time)) * 1_000_000n, raw: { price: t.price, time: t.time } };
}
/** Signs sha256("noren-price:v1|contract|token|price|ts|source") with the relayer key, as the contract verifies. */
export function signPrice(relayerKey: string, contract: string, token: string, priceUsd6: bigint, timestampNs: bigint, source = PRICE_SOURCE) {
  const message = `noren-price:v1|${contract}|${token}|${priceUsd6}|${timestampNs}|${source}`;
  const digest = createHash("sha256").update(message).digest();
  const { signature } = KeyPair.fromString(relayerKey as KeyPairString).sign(digest);
  return { token, price_usd6: priceUsd6.toString(), timestamp_ns: timestampNs.toString(), source, signature: Buffer.from(signature).toString("base64"), message };
}
export function relayerPublicKeyBase64(relayerKey: string) {
  return Buffer.from(KeyPair.fromString(relayerKey as KeyPairString).getPublicKey().data).toString("base64");
}
