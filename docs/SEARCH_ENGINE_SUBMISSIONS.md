# Search engine discovery and sitemap submission

RecruiterReply submits discovery signals only after a manually approved Production promotion succeeds. Dev and Test never run the submission job. Submission means that a supported endpoint accepted a notification; it does not guarantee crawling, indexing, ranking, or a particular timeline.

## Production assets

- `https://recruiterreply.com/sitemap.xml` is the canonical sitemap. Existing SEO checks require HTTPS production URLs, reject duplicates and private routes, and verify prerendered canonical pages.
- `https://recruiterreply.com/6d51ad9dbfcb4a998ced7f38b7262e73.txt` is the IndexNow ownership proof. The token is intentionally public and is not an authentication credential.
- Production `robots.txt` advertises the sitemap. Dev and Test remain protected by their existing `X-Robots-Tag: noindex, nofollow`, restrictive robots file, and private-access gates.

The Production promotion compares the promoted sitemap and changed frontend files with the preceding successful Production deployment. It deduplicates canonical URLs and notifies IndexNow in batches with bounded exponential retries. Deleted URLs are included so engines can recrawl them. Logs and the Actions summary contain URL counts and status, never service-account material.

## Google Search Console owner setup

Google's general Indexing API is deliberately not used; it is restricted to supported job-posting and livestream use cases. Sitemap submission uses the supported Search Console API.

1. In Google Search Console, add and verify the domain property `sc-domain:recruiterreply.com`. Use the DNS TXT verification record shown by Google and add it through the separately reviewed Route 53 process.
2. Create a dedicated Google Cloud service account with Search Console API access only. Add its email as a Search Console owner or full user for the property.
3. Store the complete service-account JSON as the Production environment secret `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON`. Do not add it to repository files, variables, logs, Dev, or Test.
4. Run a separately approved Test-to-Production promotion. The summary should say that Search Console accepted the sitemap request. Until the secret and property access exist, the workflow reports a safe skip with owner instructions.

The service-account private key is long-lived. Rotate it in Google Cloud and replace the GitHub Production environment secret on the organization's credential schedule. Prefer Google Workload Identity Federation in a later approved change if the repository's GitHub organization and Google Cloud project are configured for it.

## Verification and troubleshooting

After an approved Production promotion:

```bash
curl -fsS https://recruiterreply.com/sitemap.xml
curl -fsS https://recruiterreply.com/6d51ad9dbfcb4a998ced7f38b7262e73.txt
```

Check the workflow summary for changed URL count, IndexNow batch count, Search Console acceptance or skip, and failures. In Search Console, inspect sitemap status and individual canonical URLs. Search Console reporting can lag and must be treated as external observation rather than deployment success.

- HTTP 401/403 from Google: verify the service-account JSON, API enablement, property spelling, and the account's Search Console permission.
- HTTP 429/5xx: the workflow retries three times with bounded backoff and then fails visibly.
- IndexNow 400/403: verify the proof URL contents match the payload key and that Production serves it without redirects or authentication.
- No URL notifications: confirm the promoted SHA actually changes the sitemap or public frontend content relative to the previous successful Production deployment.

Manual fallback: submit `https://recruiterreply.com/sitemap.xml` in Search Console. For IndexNow, use the documented JSON payload and public proof key only from an owner-controlled workstation; never use the Google Indexing API as a substitute.

## Rollback

Disable the post-deployment submission job in a separately reviewed workflow change if an endpoint is misbehaving. Rolling back the application uses the existing immutable-SHA promotion process. Search-engine notifications cannot be recalled; correct or remove the public URL, deploy the fix through the normal promotion gates, and send the changed/deleted canonical URL in the next approved Production run.
