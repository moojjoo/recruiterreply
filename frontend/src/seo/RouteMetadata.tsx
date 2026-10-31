import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalUrl, getRouteMeta } from "./routes";

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = getRouteMeta(pathname);
    const canonical = canonicalUrl(meta.path);
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", "https://recruiterreply.com/og-image.png");
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "twitter:image", "https://recruiterreply.com/og-image.png");
    setMeta("name", "robots", meta.noindex ? "noindex, nofollow" : "index, follow");

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [pathname]);
  return null;
}
