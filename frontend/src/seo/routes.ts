import { guides } from "./guides";

export const SITE_URL = "https://recruiterreply.com";
export const DEFAULT_TITLE = "RecruiterReply | AI Recruiter Reply & Job Search Assistant";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
}

// Indexable public routes. Each one is prerendered to its own HTML file and listed in sitemap.xml.
export const publicRoutes: RouteMeta[] = [
  {
    path: "/",
    title: DEFAULT_TITLE,
    description:
      "RecruiterReply helps job seekers analyze recruiter messages, generate professional email replies, compare job offers, and prepare for salary negotiations with AI.",
  },
  {
    path: "/pricing",
    title: "Pricing | RecruiterReply",
    description:
      "Compare RecruiterReply plans. Start free with recruiter message analysis and reply drafts, then upgrade to Recruiter Pro for higher limits and inbox automation.",
  },
  {
    path: "/policy",
    title: "Privacy Policy | RecruiterReply",
    description:
      "How RecruiterReply collects, uses, stores, and protects your account, recruiting, and Gmail data, and the choices you have.",
  },
  {
    path: "/terms",
    title: "Terms and Conditions | RecruiterReply",
    description: "The terms that govern your access to and use of the RecruiterReply website and application.",
  },
  {
    path: "/cookies",
    title: "Cookie Policy | RecruiterReply",
    description:
      "Which essential browser storage and optional analytics cookies RecruiterReply uses, and how to change your cookie choices.",
  },
  ...guides.map((guide) => ({
    path: `/guides/${guide.slug}`,
    title: guide.title,
    description: guide.description,
  })),
];

// Auth pages are prerendered for fast loads but must never be indexed or listed in the sitemap.
export const noindexRoutes: RouteMeta[] = [
  { path: "/login", title: "Log In | RecruiterReply", description: "Log in to RecruiterReply.", noindex: true },
  { path: "/register", title: "Create Account | RecruiterReply", description: "Create a RecruiterReply account.", noindex: true },
  { path: "/forgot-password", title: "Reset Password | RecruiterReply", description: "Reset your RecruiterReply password.", noindex: true },
  { path: "/reset-password", title: "Reset Password | RecruiterReply", description: "Choose a new RecruiterReply password.", noindex: true },
];

export const notFoundRoute: RouteMeta = {
  path: "/404",
  title: "Page Not Found | RecruiterReply",
  description: "The page may have moved or the address may be incorrect.",
  noindex: true,
};

const privateRoute: RouteMeta = { path: "", title: "RecruiterReply", description: publicRoutes[0].description, noindex: true };

export function getRouteMeta(pathname: string): RouteMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (
    publicRoutes.find((route) => route.path === path) ??
    noindexRoutes.find((route) => route.path === path) ??
    (path === notFoundRoute.path ? notFoundRoute : { ...privateRoute, path })
  );
}

export function canonicalUrl(path: string): string {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}
