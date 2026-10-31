import { useLayoutEffect, useRef } from "react";

/** Reveal newly rendered results or errors, including repeat submissions. */
export function useResultReveal<T extends HTMLElement = HTMLHeadingElement>(revision: number) {
  const headingRef = useRef<T>(null);
  useLayoutEffect(() => {
    if (revision === 0) return;
    const heading = headingRef.current;
    if (!heading) return;
    const frame = requestAnimationFrame(() => {
      if (!heading.isConnected) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      heading.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [revision]);
  return headingRef;
}
