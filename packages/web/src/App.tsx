import { useEffect, useState } from "react";
import { NearLanding } from "./near/NearLanding";
import { NearCredit } from "./near/NearCredit";

/** This entry ships only the NEAR product. Old bookmarks cannot mount another app. */
export function App() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const sync = () => {
      const current = location.hash;
      const next = /^#\/near(?:\/app(?:\/(?:pay|melt))?)?$/.test(current) ? current : "#/near/app";
      if (next !== current) history.replaceState(null, "", next);
      setHash(next);
    };
    sync();
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  return hash === "#/near" ? <NearLanding /> : <NearCredit />;
}
