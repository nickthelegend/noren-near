/** Noren's gas relayer for checkout: NEP-366 meta-transactions on NEAR testnet.
 * The shopper signs a DelegateAction with their own full-access key; the relayer wraps it in a transaction that it
 * signs and pays for, so the shopper needs no NEAR for gas. The relayer accepts exactly one allowlisted call bound to
 * an open invoice, and caps how often each shopper (and everyone together) can use it per UTC day.
 * Its key is read from a gitignored file by path and never logged. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, PublicKey, Signature, actions, buildDelegateAction, encodeDelegateAction, type KeyPairString } from 'near-api-js';

/** One method per allowlisted receiver: the checkout's stablecoin transfer. */
export const RELAY_ALLOWLIST: Record<string, string[]> = { 'usdc.fakes.testnet': ['ft_transfer'] };
export const RELAY_LIMITS = { perUserPerDay: 3, globalPerDay: 50, maxGas: 15_000_000_000_000n, maxTtlBlocks: 300n, deposit: 1n } as const;

export type WireAction = { methodName: string; args: string; gas: string; deposit: string };
/** What the browser posts: the DelegateAction fields (args as base64 of the exact signed bytes) and the signature. */
export type WireDelegate = { senderId: string; receiverId: string; nonce: string; maxBlockHeight: string; publicKey: string; actions: WireAction[]; signature: string };
export type RelayRecord = { hash: string; sender: string; invoiceId: string; relayer: string; at: number; status: 'pending' | 'sent' | 'failed' };
export type PolicyContext = { invoiceId: string; payout: string; remaining: bigint; height: bigint; relays: RelayRecord[]; now: number };

const testAccount = (s: unknown): s is string => typeof s === 'string' && s.length <= 64 && /^(?:[a-z0-9]+(?:[-_][a-z0-9]+)*\.)+testnet$/.test(s);
const uint = (s: unknown, what: string) => { if (typeof s !== 'string' || !/^\d{1,39}$/.test(s)) throw Error(`Check the ${what}.`); return BigInt(s); };
export const utcDay = (at: number) => new Date(at * 1000).toISOString().slice(0, 10);

/** Every rule the relayer applies before it spends gas. Throws a readable error; returns the parsed call. */
export function checkRelayPolicy(w: WireDelegate, ctx: PolicyContext) {
  if (!w || typeof w !== 'object' || !Array.isArray(w.actions)) throw Error('Send a signed delegate action.');
  if (!testAccount(w.senderId)) throw Error('Gasless checkout is for NEAR testnet accounts only.');
  const methods = RELAY_ALLOWLIST[w.receiverId];
  if (!methods) throw Error('Noren relays payments to the test USDC contract only.');
  if (w.actions.length !== 1) throw Error('Noren relays exactly one payment call.');
  const [a] = w.actions;
  if (!a || !methods.includes(a.methodName)) throw Error('Noren relays the ft_transfer payment call only.');
  const gas = uint(a.gas, 'gas'), deposit = uint(a.deposit, 'deposit');
  if (gas <= 0n || gas > RELAY_LIMITS.maxGas) throw Error('The payment asks for more gas than the relayer pays (15 Tgas).');
  if (deposit !== RELAY_LIMITS.deposit) throw Error('The payment must attach exactly 1 yoctoNEAR.');
  let args: Record<string, unknown>;
  try { args = JSON.parse(Buffer.from(a.args, 'base64').toString('utf8')); } catch { throw Error('Payment arguments must be JSON.'); }
  if (!args || typeof args !== 'object' || Object.keys(args).sort().join() !== 'amount,memo,receiver_id') throw Error('Payment arguments must be receiver_id, amount and memo only.');
  if (args.receiver_id !== ctx.payout) throw Error('The payment does not pay this merchant.');
  if (args.memo !== `noren:${ctx.invoiceId}`) throw Error('The payment is not bound to this invoice.');
  if (typeof args.amount !== 'string' || args.amount !== String(ctx.remaining) || ctx.remaining <= 0n) throw Error('The payment amount must equal the amount due.');
  const nonce = uint(w.nonce, 'nonce'), maxBlockHeight = uint(w.maxBlockHeight, 'expiry block');
  if (nonce <= 0n) throw Error('Check the nonce.');
  if (maxBlockHeight <= ctx.height) throw Error('This signed payment has expired. Sign it again.');
  if (maxBlockHeight > ctx.height + RELAY_LIMITS.maxTtlBlocks) throw Error('This signed payment stays valid for too long.');
  const today = utcDay(ctx.now), day = ctx.relays.filter(r => utcDay(r.at) === today);
  if (ctx.relays.some(r => r.invoiceId === ctx.invoiceId && r.status === 'pending')) throw Error('A gasless payment for this link is already in flight.');
  if (day.filter(r => r.sender === w.senderId).length >= RELAY_LIMITS.perUserPerDay) throw Error(`Gasless limit reached: ${RELAY_LIMITS.perUserPerDay} payments per account per day. Pay with your own NEAR for gas, or try tomorrow.`);
  if (day.length >= RELAY_LIMITS.globalPerDay) throw Error('Noren\'s gas relayer reached today\'s limit. Pay with your own NEAR for gas, or try tomorrow.');
  return { args, gas, deposit, nonce, maxBlockHeight };
}

/** Rebuilds the exact DelegateAction the shopper signed and checks the ed25519 signature over its NEP-461 hash. */
export function rebuildSigned(w: WireDelegate) {
  let publicKey: PublicKey;
  try { publicKey = PublicKey.fromString(w.publicKey); } catch { throw Error('Check the signing public key.'); }
  if (publicKey.keyType !== 0) throw Error('Gasless checkout accepts ed25519 keys only.');
  const delegateAction = buildDelegateAction({
    senderId: w.senderId, receiverId: w.receiverId, nonce: BigInt(w.nonce), maxBlockHeight: BigInt(w.maxBlockHeight), publicKey,
    actions: w.actions.map(a => actions.functionCall(a.methodName, new Uint8Array(Buffer.from(a.args, 'base64')), BigInt(a.gas), BigInt(a.deposit))),
  });
  const hash = new Uint8Array(createHash('sha256').update(encodeDelegateAction(delegateAction)).digest());
  const data = new Uint8Array(Buffer.from(String(w.signature ?? ''), 'base64'));
  if (data.length !== 64 || !publicKey.verify(hash, data)) throw Error('The payment signature does not verify for this account key.');
  return { delegateAction, signature: new Signature({ keyType: 0, data }), hash };
}

export type GasRelayer = {
  accountId: string;
  height: () => Promise<bigint>;
  /** The shopper's key must be a full-access key (NEAR rejects deposits signed by function-call keys). */
  accessKey: (accountId: string, publicKey: string) => Promise<{ nonce: bigint; fullAccess: boolean }>;
  send: (signed: ReturnType<typeof rebuildSigned>) => Promise<{ hash: string; ok: boolean }>;
};

/** Reads `{accountId, privateKey}` from NOREN_GAS_RELAYER_FILE (default `.near-credentials/gas-relayer.json`). */
export function loadGasRelayer(rpc: string, file = process.env.NOREN_GAS_RELAYER_FILE ?? findCredentials()): GasRelayer | null {
  if (!file || !existsSync(file)) return null;
  const c = JSON.parse(readFileSync(file, 'utf8')) as { accountId?: string; privateKey?: string };
  if (!testAccount(c.accountId) || typeof c.privateKey !== 'string') throw Error('Setup required: NOREN_GAS_RELAYER_FILE must hold a testnet accountId and privateKey.');
  const provider = new JsonRpcProvider({ url: rpc });
  const account = new Account(c.accountId, provider, new KeyPairSigner(KeyPair.fromString(c.privateKey as KeyPairString)));
  c.privateKey = '';
  return {
    accountId: c.accountId,
    height: async () => BigInt((await provider.viewBlock({ finality: 'final' })).header.height),
    accessKey: async (accountId, publicKey) => {
      const k = await provider.viewAccessKey({ accountId, publicKey }) as unknown as { nonce: number | string | bigint; permission: unknown };
      return { nonce: BigInt(k.nonce), fullAccess: k.permission === 'FullAccess' };
    },
    send: async ({ delegateAction, signature }) => {
      const r = await account.signAndSendTransaction({ receiverId: delegateAction.senderId, actions: [actions.signedDelegate({ delegateAction, signature })], waitUntil: 'FINAL', throwOnFailure: false }) as unknown as { transaction: { hash: string }; status: { Failure?: unknown }; receipts_outcome?: { outcome?: { status?: { Failure?: unknown } } }[] };
      return { hash: r.transaction.hash, ok: !r.status.Failure && !r.receipts_outcome?.some(x => x.outcome?.status?.Failure) };
    },
  };
}
function findCredentials() {
  for (let dir = process.cwd(), i = 0; i < 4; i++, dir = resolve(dir, '..')) {
    const f = resolve(dir, '.near-credentials/gas-relayer.json');
    if (existsSync(f)) return f;
  }
  return undefined;
}
