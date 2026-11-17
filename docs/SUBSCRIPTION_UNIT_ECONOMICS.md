# Subscription unit economics contract

This document defines the reporting contract for issue #655. Stripe-authoritative billing facts and application-authoritative usage facts remain separate from consented GA4 analytics. Dev, Test, and Production data must never be combined. Reporting windows are half-open UTC intervals: `[start, end)`.

## Metric definitions

| Metric | Definition and source |
| --- | --- |
| Contracted MRR | Sum of normalized monthly recurring contract value for paid subscriptions active at period end. Divide annual contract value by 12; invoice cash is not MRR. Exclude trials, free, canceled, incomplete, and zero-value contracts. |
| Contracted ARR | Contracted MRR multiplied by 12. |
| Paid active | Distinct paid subscriptions active at period end from latest durable subscription state; never infer from a checkout redirect or invoice count. |
| Trials | Distinct subscriptions entering trial during the period from verified lifecycle event time. |
| Activation | Eligible trial accounts completing the versioned activation event within its window, divided by eligible trial accounts. GA4 is directional only because consent excludes part of the population. |
| Trial-to-paid | Trials whose first positive paid subscription invoice occurs in the conversion window, divided by eligible ended trials. Exclude trial and zero-dollar invoices. |
| Logo churn | Paid subscriptions ending in the period divided by paid subscriptions active at period start. |
| NRR | Opening recurring revenue plus expansion, less contraction and churn, divided by opening recurring revenue for the same cohort and currency. Do not use invoice collections. |
| ARPPU | Recognized subscription revenue divided by distinct paid accounts in the same period and currency. |
| Refunds | Verified Stripe refund amount created in the period, separately by currency. |
| Failed-payment recovery | Failed subscription invoices later paid in the recovery window, divided by eligible failed subscription invoices, joined by invoice ID. |
| AI cost/customer | Attributed model cost divided by eligible active customers, segmented by plan and currency, using model/token usage and a versioned price table. |
| Contribution margin | Recognized revenue less refunds, Stripe fees, AI cost, and defined variable costs. If any component is unavailable, the result is unknown. |
| CAC | Eligible acquisition spend divided by newly acquired paying customers under a documented attribution window. |

Cash collected is separate from contracted MRR/ARR. Different currencies are never summed without an explicit, versioned foreign-exchange policy.

## Foundation behavior

The deterministic calculator accepts normalized synthetic facts containing event ID, billing object ID, subscription ID, UTC occurrence time, environment, plan, currency, amount, and optional contracted monthly amount. It filters one environment; deduplicates webhook and invoice/refund IDs; orders lifecycle state by occurrence time rather than delivery time; keeps cash separate from recurring value; reports currencies separately; and returns nullable values plus stable warnings for unavailable inputs.

Synthetic tests use invented identifiers and amounts only. They do not establish correctness of live Stripe configuration or customer figures.

## Current gaps and warnings

The current `stripe_paid_invoices` table records positive invoice amount, currency, event ID, customer ID, and processing time with invoice-ID idempotency. It lacks subscription ID, plan, Stripe event occurrence time, environment/mode, refunds, and failed-payment recovery. `usage_records` stores feature counts but not model, tokens, or cost. Refund, AI-cost, margin, churn, conversion, and CAC values must therefore remain unknown until their complete sources exist.

## Remaining delivery slices

1. Separately review an additive durable event schema with environment isolation, opaque internal joins, UTC Stripe occurrence time, subscription ID, plan, and uniqueness. Follow `docs/DATABASE_MIGRATION_POLICY.md`.
2. Add signed Stripe test-mode fixtures for subscription state, invoices, refunds, failures/recovery, cancellations, duplicates, and out-of-order delivery.
3. Add model/token cost capture and a versioned cost table without exposing customer or production data.
4. Build an owner-only aggregate query/API and dashboard with current/prior periods, trend, and freshness; authorization and billing-read restrictions require security review.
5. Validate figures with the owner. Finance commentary may use only approved aggregates or synthetic data.

GA4 stays production-host-only, consent-aware, and non-authoritative for revenue. Analytics and reports must not contain payment credentials, raw webhook payloads, customer content, or full payment identifiers.
