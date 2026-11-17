# Support Agent: offline draft-only baseline (#656)

## Status and limits

This is an isolated synthetic pilot, **not a deployed support agent**. It has no
network calls, LLM integration, account access, customer data, persistent ticket
store, or ability to send messages or execute actions. It changes no application
route, workflow, authentication, billing, infrastructure, or database.

The versioned knowledge snapshot summarizes the cited repository Terms/Privacy
sections as of main commit `2caad26`. These sources contain known product-policy
gaps: for example, published Terms speak of paid features conditionally. The pilot
therefore does not infer current prices, trial duration, refund eligibility,
service availability, legal compliance, or successful account operations.

Exact curated question matching is a deliberately conservative retrieval baseline,
not semantic retrieval or an LLM. Unsupported wording escalates, including prompts
that combine a supported question with extra instructions. This prioritizes safe
failure over broad coverage. Every result requires human review, even a matching
draft. References identify source paths and section names, not proof of live state.

## Run locally

From the repository root, with Node.js:

```bash
node --test scripts/support-agent/pilot.test.cjs
node scripts/support-agent/evaluate.cjs
```

No credentials or dependencies are needed. The evaluation emits aggregate metrics
and synthetic case IDs only; it never copies questions, ticket content, emails,
tokens, or account identifiers into the report. The input dataset is synthetic.

The 30 draft cases cover product use, AI review, Gmail consent, privacy, plans,
trials, billing disputes, cancellation, refunds, security, account deletion,
errors, unsupported questions, and prompt injection. They are **not owner-approved**
and exact-match routing accuracy must not be presented as measured LLM answer
quality or customer satisfaction.

## Review and escalation

A host may call `draftSupportReply(question)` only with synthetic test data for
this slice. `outcome=escalate` means prepare a human handoff, not resolve or send
anything. Billing, security, deletion, recovery, and unknown requests always
escalate. The caller must not interpret `draft` as permission to send.

`summarizeFeedback` accepts only synthetic case ID plus a bounded review verdict.
It rejects extra fields and duplicate IDs. It returns aggregate counts and stores
nothing. Human correctness review remains separate from automated route checks.

## Measurement contract

| Metric | Evidence in this slice |
| --- | --- |
| Routing accuracy | Expected outcome/category/article over 30 synthetic cases |
| Unsafe action count | All results must be draft-only, human-reviewed and unsendable |
| Escalation rate | Escalated cases / 30; not a real customer rate |
| Latency | Local computation mean; not model or service latency |
| Provider calls / cost | Zero: no provider is called |
| Total cost per ticket | Unknown (`null`); compute/support costs unmeasured |
| Customer satisfaction | Unknown (`null`); no users enrolled |

## Remaining gates before #656 can close

1. Complete readiness audit #653 and reconcile owner-approved support policies,
   pricing, cancellation, trial and privacy language with actual product behavior.
2. Review/approve the knowledge snapshot and evaluation labels, add independent
   paraphrased holdout cases, and evaluate any semantic/model retrieval separately.
3. Define a tenant-scoped authenticated integration, retention/deletion contract,
   access controls and redaction review before handling any customer data.
4. Add feedback persistence and a human-owned ticket handoff with explicit consent
   and no automatic refunds, deletion, account changes, or external sends.
5. Measure real provider latency/cost and approved satisfaction proxies.
6. Obtain owner approval for any transition beyond draft-only mode. Keep Test and
   Production deployment separately authorized.

This partial implementation must not auto-close #656 or claim those gates passed.
