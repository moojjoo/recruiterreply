# Issue #400 — Inbound forwarding implementation and acceptance plan

## Approved configuration

| Source | Destination |
| --- | --- |
| privacy@recruiterreply.com | robert.dannelly@dannellysolutions.com |
| legal@recruiterreply.com | robert.dannelly@dannellysolutions.com |

No other aliases and no catch-all. Keep Route 53 authoritative and preserve existing SES outbound identity and DKIM/SPF/DMARC.

## Safety gates before DNS changes

1. Inventory live Route 53 MX/TXT/CNAME records and SES domain identity status. Do not overwrite or duplicate SPF records.
2. Choose a provider with a verified free plan and external DNS support. Record exact provider MX/TXT instructions and destination verification steps.
3. Obtain destination verification from the mailbox owner. Do not commit mailbox tokens or passwords.
4. Produce a Terraform plan scoped to approved DNS changes and verify there are no unrelated changes. Require explicit approval for any Test or Production apply.
5. After approved apply, inspect authoritative DNS and verify existing SES sending is unaffected.

## Automated acceptance

Run `node --test scripts/email-forwarding/check-config.test.cjs` for the configuration validator. When a forwarding provider is selected, export its *actual* alias configuration into the JSON format below and run `node scripts/email-forwarding/check-config.cjs provider-export.json`:

```json
{
  "catchAll": false,
  "aliases": [
    {"source": "privacy@recruiterreply.com", "destination": "robert.dannelly@dannellysolutions.com"},
    {"source": "legal@recruiterreply.com", "destination": "robert.dannelly@dannellysolutions.com"}
  ]
}
```

This check validates an input configuration; it does **not** prove the provider is configured unless the JSON is generated from a trusted provider API or authoritative configuration. Never treat a manually written JSON file as proof of deployment.

End-to-end acceptance must send uniquely tagged low-volume messages to both addresses and verify their actual receipt in the destination mailbox using a user-authorized, least-privilege inbox integration. Until that integration or manual verification is available, report **PENDING MANUAL VERIFICATION**, not PASS. SMTP acceptance alone is insufficient.

## Terraform/OIDC

The repository already has a GitHub OIDC module at `infra/aws/terraform/modules/github_oidc/`. Reuse and review existing roles and workflows rather than creating duplicate providers. Before adding plan/apply permissions, inventory the Terraform root modules and state boundaries, scope trust policies to the exact repository/environment, and enforce explicit Test and Production approvals. Keep plan artifacts bound to commit SHA and environment. Do not automate Production rollback.

## Status

This change establishes a tested, fail-closed alias configuration validator and implementation checklist. Provider selection, actual forwarding, IAM role changes, Terraform applies, and live email delivery verification are **not yet implemented**.
