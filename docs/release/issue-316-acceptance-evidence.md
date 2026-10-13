# Issue #316 — PR automation and Dev release acceptance evidence

Status: **INCOMPLETE — approval gates remain unchanged**.

The following earlier changes are merged: #315 (draft PR safety), #317 (preliminary readiness gate), #323 (bounded CI diagnostics foundation), and #336 (deterministic CI feedback and release gate tests). Merge status alone does not prove the full acceptance criteria.

## Required proof matrix

| Gate | Evidence to collect | Passing condition |
| --- | --- | --- |
| Draft/incomplete PR | Workflow run and PR metadata | Drafts, unchecked criteria and blocked reviews never auto-merge |
| Eligible PR | PR number, head SHA, check URLs, merge SHA | Owner-approved readiness policy; required checks pass before merge |
| Failed CI | Run URL, SHA, diagnostic comment and retry count | Actionable report, bounded remediation, no unsafe mutation |
| Software Factory | Cross-repo workflow run URLs, permissions and versions | Integration proven in both repositories with least privilege |
| Immutable artifacts | Build URL, backend image digest, frontend artifact checksum | Same merged main SHA across builds and deployments |
| Dev rollout | Deploy run URL, running SHA, health and smoke URLs | Automatic Dev deployment and exact SHA verification |
| Test and Prod | Environment protection evidence and approval records | Human approval mandatory; only validated SHA promoted |
| Rollback | Revert/redeploy runbook and tested command outputs | No Terraform/IAM/secrets bypass; documented recovery |

## Safe execution procedure

1. Audit GitHub branch protection and required check names, including the stable CodeQL gate introduced in #354. Record existing settings before edits.
2. Compare merged workflow implementations to acceptance criteria. Confirm PR events (opened, synchronize, ready_for_review), permissions, draft checks, review threads and check-run semantics.
3. Review the corresponding workflows in `moojjoo/dannellysolutions-software-factory`; record cross-repo contracts and do not grant broad PAT permissions.
4. Run a **low-risk, approved** eligible PR through CI and automatic merge to Dev. Record PR head SHA, merge SHA, artifact identifiers, Dev deployment and live health/smoke output.
5. Use a deliberately failing, non-security-sensitive test PR to confirm bounded remediation or blocked status. Do not auto-fix secrets, IAM, Terraform or production code.
6. Inspect Test/Production GitHub Environment protection and promotion workflows without deploying. Capture evidence that manual approval is still required.
7. Attach run links and evidence to #316. Only mark complete when every matrix row is proven.

## Guardrails

- No auto-ready or auto-merge of draft or incomplete PRs.
- No Terraform apply, IAM/Secrets Manager changes, or security bypass as part of automated remediation.
- No Test/Production promotion without explicit approval.
- This evidence document alone is **not** completion and does not enable automatic deployment.
