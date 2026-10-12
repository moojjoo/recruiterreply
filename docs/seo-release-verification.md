# SEO deployment verification (Issue #312)

The Search Console setup is already complete. This checklist is for engineering verification, not owner setup.

## Current scope
The static landing pages and the built-artifact SEO assertions are under test. The React homepage is **not yet prerendered**; a static metadata-only index.html is insufficient. Do not mark #312 done or merge the stacked PRs until real HTML and hydration are implemented and verified.

## Required release checks
- `npm ci && npm run lint && npm run build && npm run test:seo` in frontend
- With JavaScript disabled, GET / and /pricing must contain actual route-specific visible content and one H1, not only an empty root element.
- Validate route-specific canonical and schema on /, /pricing, and all indexed pages; ensure private routes never inherit public canonical.
- Validate CloudFront Terraform-managed X-Robots-Tag for Dev/Test, not just robots.txt. Check representative 200, SPA fallback, error and static responses. Production must not return blanket noindex.
- Ensure CloudFront SPA fallback does not return 200 + homepage canonical for nonexistent paths.
- Confirm unauthenticated private data requests are rejected by the backend.
- Lighthouse mobile baseline on Dev with documented LCP, CLS, TBT and performance/accessibility/SEO scores; do not assume pass.
- Test login, registration, theme toggle, consent/GA4 and Stripe after frontend hydration.
- Promote the same pinned SHA Dev -> Test -> Prod only with explicit approval.

## Example probes (replace hosts with actual verified URLs)
```bash
curl -sSI https://dev.recruiterreply.com/
curl -sSI https://test.recruiterreply.com/pricing
curl -sSI https://recruiterreply.com/
curl -sS https://dev.recruiterreply.com/ | grep -E '<h1|id="root"'
curl -sSI https://recruiterreply.com/sitemap.xml
curl -sSI https://recruiterreply.com/robots.txt
```

**No live response, Terraform apply, Lighthouse run, or deploy is claimed by this document.**
