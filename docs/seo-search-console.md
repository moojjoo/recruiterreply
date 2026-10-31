# RecruiterReply SEO rollout

## Current baseline
React/Vite frontend on S3 + CloudFront. The build prerenders the homepage, pricing, legal pages, auth pages, and three long-form guides. Each indexable route has its own title, description, canonical, social metadata, visible H1, and raw HTML. Auth pages are prerendered with `noindex`; authenticated routes remain client-rendered and excluded from the sitemap. GA4 remains consent-gated.

## Owner actions
1. In Google Search Console, create a **Domain** property for recruiterreply.com.
2. Add Google's TXT verification record in the authoritative Route 53 hosted zone; keep existing DNS records intact.
3. After Production deployment, submit https://recruiterreply.com/sitemap.xml.
4. Use URL Inspection for the homepage and public pages; record indexed status and discovered canonical URL.
5. Associate Search Console with the existing GA4 property (G-LRR12SSGH7) if appropriate.
6. Record branded query impressions, clicks, CTR and average position each month. First-page placement cannot be guaranteed.
7. Add Bing Webmaster Tools and import the verified Search Console property where supported.

## Release validation
- Check `/`, `/pricing`, `/policy`, `/terms`, `/cookies`, and every sitemap URL via curl without executing JavaScript; HTML must include route-specific meaningful text, an H1, and a self-referencing canonical.
- Confirm /sitemap.xml returns XML with HTTP 200, not SPA fallback.
- Confirm /robots.txt returns plain text with HTTP 200, not SPA fallback.
- Verify production public URLs are indexable, but auth/private routes are noindex and excluded from sitemap.
- Verify Dev/Test return X-Robots-Tag: noindex for all HTML and SPA fallback responses. Because the same frontend artifact is promoted across environments, configure this at the CloudFront response layer, not by embedding a fixed robots policy in the artifact.
- Verify canonical host redirects, structured data validity, Core Web Vitals, and accessibility.
- Verify the three legacy `seo-*.html` URLs return 301 to their `/guides/...` replacements.
- Verify `www` over HTTP and HTTPS redirects to the equivalent apex HTTPS URL without a loop.
- Verify the 1200×630 PNG social image in LinkedIn Post Inspector and an X card validator.
- Verify auth, Stripe, and GA4 consent behavior remain unchanged.

## Measurement cadence

Record branded and non-branded impressions, clicks, CTR, average position, and indexed-page count monthly. Track the guide queries separately from branded queries. Rankings are outcomes influenced by content quality, competition, crawl history, and backlinks; a release can improve technical eligibility but cannot guarantee first-page placement.

## Deployment boundary

The repository change prepares CloudFront, Route 53, and ACM configuration. Applying Terraform in Production, promoting beyond Dev, Search Console submission, Bing setup, and backlink work remain separate owner-authorized actions.
