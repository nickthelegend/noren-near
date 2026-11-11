// Noren's 3D object kit (docs/ART-3D.md): glossy aizome-indigo lacquer with kaki details, no face.
// One object per card; width and height are fixed so nothing shifts while the webp loads.
export type Art3dKey =
  | "stall" | "card" | "btc-coin" | "receipt" | "gauge" | "price-tag" | "calendar"
  | "hourglass" | "shield" | "empty" | "success" | "warning" | "medal";

const ALT: Record<Art3dKey, string> = {
  stall: "Indigo lacquer shop stall with a kaki noren curtain",
  card: "Indigo lacquer credit card with a kaki chip",
  "btc-coin": "Indigo coin with a kaki Bitcoin symbol and a padlock",
  receipt: "Indigo receipt slip with a kaki check stamp",
  gauge: "Indigo health gauge with its kaki needle in the safe zone",
  "price-tag": "Indigo price tag with a kaki wax seal",
  calendar: "Indigo desk calendar with three kaki dots",
  hourglass: "Indigo hourglass with kaki sand",
  shield: "Indigo shield with a kaki keyhole",
  empty: "Empty indigo coin tray",
  success: "Indigo badge with a kaki check mark",
  warning: "Indigo warning sign with a kaki exclamation mark",
  medal: "Indigo rosette medal with kaki ribbons",
};

export function Art3d({ k, size, className, alt }: { k: Art3dKey; size: number; className?: string; alt?: string }) {
  return (
    <img
      className={`n3d ${className ?? ""}`}
      src={`${import.meta.env.BASE_URL}art/3d/noren-3d-${k}.webp`}
      width={size}
      height={size}
      alt={alt ?? ALT[k]}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}
