import { meltCurve } from "./data";

/** The debt over time as collateral yield is harvested into it. Always labelled a projection: nothing here is a
 *  harvest that happened. `tone` picks the light (app) or night (landing) palette. */
export function MeltChart({ debtUsd, collateralUsd, supplyApy, aprBps, tone = "light" }: { debtUsd: number; collateralUsd: number; supplyApy: number; aprBps: number; tone?: "light" | "night" }) {
  const { points, payoff } = meltCurve(debtUsd, collateralUsd, supplyApy, aprBps);
  const W = 640, H = 220, padL = 8, padR = 8, padT = 18, padB = 28;
  const max = Math.max(...points.map((p) => p.debt), 0.0001);
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
  const y = (d: number) => padT + (1 - d / max) * (H - padT - padB);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.debt).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)},${H - padB} L${x(t0).toFixed(1)},${H - padB} Z`;
  const years = Math.max(1, Math.round((t1 - t0) / (365.25 * 86_400_000)));
  const ticks = Array.from({ length: Math.min(years, 6) + 1 }, (_, i) => t0 + (i * (t1 - t0)) / Math.min(years, 6));
  const harvests = points.filter((_, i) => i > 0 && i % 6 === 0 && i < points.length - 1);
  const id = `melt-${tone}`;
  return (
    <figure className={`nm-chart ${tone}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={payoff ? `Projected debt reaches zero on ${payoff.toDateString()}` : "Projected debt does not reach zero at the current rates"} preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} className="nm-grid" />)}
        <path d={area} fill={`url(#${id})`} className="nm-area" />
        <path d={line} className="nm-line" />
        {harvests.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.debt)} r="3" className="nm-dot" />)}
        {payoff && <circle cx={x(payoff.getTime())} cy={y(0)} r="5" className="nm-end" />}
        {ticks.map((t) => <text key={t} x={x(t)} y={H - 8} className="nm-tick" textAnchor={t === t0 ? "start" : t === t1 ? "end" : "middle"}>{new Date(t).getFullYear()}</text>)}
      </svg>
      <figcaption>Projection. Dots are where monthly harvests would land; none has happened on-chain.</figcaption>
    </figure>
  );
}
