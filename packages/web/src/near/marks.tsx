import { useState, type CSSProperties } from "react";
const LOGOS: Record<string, { file: string; name: string; bg?: string; pad?: number }> = {
  USDC: { file: "/logos/usdc.svg", name: "USDC" },
  ETH: { file: "/logos/eth.svg", name: "Ether", bg: "#eceefb", pad: 0.17 },
};
const logoKey = (id: string) => id.toUpperCase();

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

