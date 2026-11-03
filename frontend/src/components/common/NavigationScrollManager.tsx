import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Keep route navigation independent of tool-result scrolling. */
export function NavigationScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const pathChanged = previousPath.current !== pathname;
    previousPath.current = pathname;

    // Let the browser restore history positions for Back/Forward.
    if (navigationType === "POP" && !hash) return;

    if (hash) {
      let id: string;
      try { id = decodeURIComponent(hash.slice(1)); }
      catch { return; }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }

    if (pathChanged) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}
