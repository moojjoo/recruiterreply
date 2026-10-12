# RecruiterReply SEO rollout

## Current baseline
React/Vite frontend on S3 + CloudFront. Existing index.html includes a canonical homepage link, meta description, social tags, and GA4 consent-based loading. Existing robots.txt and sitemap.xml require an environment-aware review. Do not treat metadata alone as sufficient for JavaScript-rendered routes.

## Owner actions
1. In Google Search Console, create a **Domain** property for recruiterreply.com.
2. Add Google's TXT verification record in the authoritative Route 53 hosted zone; keep existing DNS records intact.
3. After Production deployment, submit https://recruiterreply.com/sitemap.xml.
4. Use URL Inspection for the homepage and public pages; record indexed status and discovered canonical URL.
5. Associate Search Console with the existing GA4 property (G-LRR12SSGH7) if appropriate.
6. Record branded query impressions, clicks, CTR and average position each month. First-page placement cannot be guaranteed.

## Release validation
- Check homepage and /pricing via curl without executing JavaScript; HTML must include route-specific meaningful text and canonical metadata.
- Confirm /sitemap.xml returns XML with HTTP 200, not SPA fallback.
- Confirm /robots.txt returns plain text with HTTP 200, not SPA fallback.
- Verify production public URLs are indexable, but auth/private routes are noindex and excluded from sitemap.
- Verify Dev/Test return X-Robots-Tag: noindex for all HTML and SPA fallback responses. Because the same frontend artifact is promoted across environments, configure this at the CloudFront response layer, not by embedding a fixed robots policy in the artifact.
- Verify canonical host redirects, structured data validity, Core Web Vitals, and accessibility.
- Verify auth, Stripe, and GA4 consent behavior remain unchanged.

## Follow-up engineering work
Implement route-specific prerendering (or SSR), metadata and JSON-LD, production-vs-nonprod indexability headers, helpful landing pages, automated crawler checks, and performance budgets before marking issue #306 complete. Do not deploy unfinished SEO infrastructure to Production.
