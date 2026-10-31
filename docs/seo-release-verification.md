# SEO deployment verification (Issues #312 and #535)

The Search Console setup is already complete. This checklist is for engineering verification, not owner setup.

## Current scope
The build prerenders all indexable public routes and auth routes, generates a dedicated noindex 404 page, and hydrates the same React route on the client. Built-artifact tests enforce unique route metadata, guide schemas and content length, sitemap membership, social-image dimensions, and a 350 KiB initial JavaScript budget.

## Required release checks
- `npm ci && npm run lint && npm run build && npm run test:seo` in frontend
- With JavaScript disabled, GET / and /pricing must contain actual route-specific visible content and one H1, not only an empty root element.
- Validate route-specific canonical and schema on /, /pricing, and all indexed pages; ensure private routes never inherit public canonical.
- Validate CloudFront Terraform-managed X-Robots-Tag for Dev/Test, not just robots.txt. Check representative 200, SPA fallback, error and static responses. Production must not return blanket noindex.
- Ensure CloudFront SPA fallback does not return 200 + homepage canonical for nonexistent paths.
- Confirm known SPA deep links such as `/dashboard` load the application, while an unknown path returns HTTP 404 with the noindex Not Found page.
- Confirm the three legacy `.html` landing-page URLs return 301 to their corresponding `/guides/...` URL.
- Confirm `https://www.recruiterreply.com/` and `http://www.recruiterreply.com/` redirect to `https://recruiterreply.com/` without a loop.
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
curl -sSI https://recruiterreply.com/does-not-exist
curl -sSI https://recruiterreply.com/dashboard
curl -sSI https://recruiterreply.com/seo-recruiter-replies.html
curl -sSI https://www.recruiterreply.com/
```

For every URL in `sitemap.xml`, verify HTTP 200 and compare the response canonical to the requested URL. For `/login`, `/register`, `/forgot-password`, and `/reset-password`, verify `noindex` in raw HTML and absence from the sitemap. Validate one guide with Google Rich Results Test and validate `og-image.png` in LinkedIn Post Inspector and an X card validator.

**No live response, Terraform apply, Lighthouse run, or deploy is claimed by this document.**
