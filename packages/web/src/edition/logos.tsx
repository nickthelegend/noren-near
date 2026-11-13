/**
 * Real logos for every token, chain and protocol Noren shows. Every file is self-hosted in public/logos (no request
 * to a third party); public/logos/SOURCES.md records where each one came from. Anything without a file is drawn as a
 * neutral circle with its initials, never an invented logo.
 */
import { useState, type CSSProperties } from "react";

type Spec = { file: string; name: string; bg?: string; pad?: number };
const S = (file: string, name: string, bg?: string, pad?: number): Spec => ({ file: `/logos/${file}`, name, bg, pad });

export const LOGOS: Record<string, Spec> = {
 USDC:S("usdc.svg","test USDC"), ETH:S("eth.svg","Ether","#eceefb",.17),
 NVDA:S("nvda.svg","TEST NVIDIA","#fff",.09), TSLA:S("tsla.png","TEST Tesla","#171a20",.24), AAPL:S("aapl.svg","TEST Apple","#fff",.2),
};
export function logoKey(s:string){const k=s.replace(/^t(?=TSLA|NVDA|AAPL)/,'').toUpperCase();return LOGOS[k]?k:undefined;}

/**
 * A round logo at 16/20/24 px (any size works). `id` is a token symbol, chain or protocol (see logoKey). Decorative by
 * default: the symbol is always written next to it; pass `label` when it stands alone.
 */
export function Mark({ id, size = 20, label, className = "", style }: { id: string; size?: number; label?: string; className?: string; style?: CSSProperties }) {
  const key = logoKey(id);
  const spec = key ? LOGOS[key] : undefined;
  const [broken, setBroken] = useState(false);
  const box: CSSProperties = { width: size, height: size, ...style };
  if (!spec || broken) {
    const init = id.replace(/[^A-Za-z0-9]/g, "").slice(0, id.length > 3 ? 2 : 3).toUpperCase() || "?";
    return <span className={`lg-mark lg-none ${className}`} style={{ ...box, fontSize: Math.max(7, size * (init.length > 2 ? 0.3 : 0.38)) }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>{init}</span>;
  }
  const pad = Math.round(size * (spec.pad ?? 0) * 10) / 10;
  return (
    <span className={`lg-mark ${className}`} style={{ ...box, background: spec.bg ?? "transparent", padding: pad }} role={label ? "img" : undefined} aria-label={label ?? undefined} aria-hidden={label ? undefined : true} title={label ? undefined : spec.name}>
      <img src={spec.file} alt="" width={size} height={size} decoding="async" draggable={false} onError={() => setBroken(true)} />
    </span>
  );
}

/** Two marks overlapping (a pair, or a token on its chain). */
export const MarkPair = ({ a, b, size = 20 }: { a: string; b: string; size?: number }) => (
  <span className="lg-pair" style={{ width: size * 1.6, height: size }} aria-hidden><Mark id={a} size={size} /><Mark id={b} size={size} /></span>
);
