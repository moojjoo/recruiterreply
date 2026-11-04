import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const HASH_TARGET_RETRY_FRAMES = 60;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusRouteHeading() {
  const heading = document.querySelector<HTMLElement>("main h1");
  if (!heading) return;

  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}

/** Coordinates route, hash, history, and keyboard focus without touching tool-result reveals. */
export function NavigationScrollManager() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const pathChanged = previousPath.current !== pathname;
    previousPath.current = pathname;
    let frame = 0;
    let cancelled = false;

    if (hash) {
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }

      let remainingFrames = HASH_TARGET_RETRY_FRAMES;
      const revealHashTarget = () => {
        if (cancelled) return;
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "start",
          });
          return;
        }
        remainingFrames -= 1;
        if (remainingFrames > 0) frame = requestAnimationFrame(revealHashTarget);
      };
      frame = requestAnimationFrame(revealHashTarget);
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    // Native history restoration owns Back/Forward positions.
    if (navigationType === "POP" || !pathChanged) return;

    frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      focusRouteHeading();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash, navigationType]);

  return null;
}
