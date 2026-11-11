import { useEffect, useState, type ReactNode } from "react";
import { api, SERVER, type Config } from "./api";

export const isFork = (cfg: Config | null) => !cfg || /127\.0\.0\.1|localhost/.test(cfg.rpcUrl);
/** viem errors carry request dumps; show the human part only. */
export const msgOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
  const head = m.split(/Request Arguments:|Contract Call:|Raw Call Arguments:|\n\n/)[0].trim();
  return head.length > 220 ? head.slice(0, 220) + "…" : head;
};

export type Route =
  | { page: "home" }
  | { page: "dashboard"; tab: "home" | "balances" | "payments" | "links" | "developers" | "settings" | "onboard"; sub?: string }
  | { page: "pay"; id: string }
  | { page: "app" }
  | { page: "tx"; chain: string; hash: string };
export function useRoute(): Route {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => { const on = () => { setHash(location.hash); window.scrollTo(0, 0); }; addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, []);
  const t = /^#\/tx\/([\w-]+)\/([^/?#]+)/.exec(hash);
  if (t) return { page: "tx", chain: t[1], hash: t[2] };
  const m = /^#\/pay\/([^/?#]+)/.exec(hash);
  if (m) return { page: "pay", id: m[1] };
  if (/^#\/(app|credit)\b/.test(hash)) return { page: "app" };
  const d = /^#\/(dashboard|merchant)(?:\/(balances|payments|links|developers|settings|onboard))?(?:\/([\w-]+))?/.exec(hash);
  if (d) return { page: "dashboard", tab: (d[2] as never) ?? "home", sub: d[3] };
  return { page: "home" };
}

export function useConfig() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.config().then(setCfg).catch((e) => setErr(e.message)); }, []);
  return { cfg, err };
}

export function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn ghost xs" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* clipboard blocked */ } }} aria-label={`${label}: ${text}`}>
      {done ? <Icon.check /> : <Icon.copy />}<span>{done ? "Copied" : label}</span>
    </button>
  );
}

export function Setup({ err, compact }: { err: string; compact?: boolean }) {
  return (
    <div className={`setup ${compact ? "compact" : ""}`} role="alert">
      <span className="eyebrow">Setup required</span>
      <h2>The merchant server isn't running.</h2>
      <p>{err}</p>
      <pre>{`pnpm install\npnpm dev:stack                # Arc testnet fork + contracts + merchant API + compliance postman\npnpm --filter @noren/web dev  # this app on :5190`}</pre>
      <p className="faint sm">API: {SERVER}</p>
    </div>
  );
}

export { Logo, Icon } from "./brand";
import { Icon } from "./brand";
