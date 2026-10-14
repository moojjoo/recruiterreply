import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView, trackProductEvent } from "../../utils/productAnalytics";

export function AnalyticsRouteTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView(pathname, document.title);
    if (pathname === "/pricing") trackProductEvent("pricing_viewed");
  }, [pathname]);

  return null;
}
