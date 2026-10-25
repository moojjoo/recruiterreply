# Issue 320 acceptance evidence

Issue [#320](https://github.com/moojjoo/recruiterreply/issues/320) introduced controlled,
evidence-based issue closure and read-only reconciliation reporting. The implementation was
delivered incrementally so that no partial pull request could close the feature prematurely.

## Implementation

- PR [#321](https://github.com/moojjoo/recruiterreply/pull/321) added the pull-request
  contract and initial read-only audit.
- PR [#322](https://github.com/moojjoo/recruiterreply/pull/322) strengthened evidence gates.
- PR [#332](https://github.com/moojjoo/recruiterreply/pull/332) made missing-token and
  project-access reporting truthful and fail-closed.
- PR [#361](https://github.com/moojjoo/recruiterreply/pull/361) added scheduled and
  post-deployment reporting.
- PR [#390](https://github.com/moojjoo/recruiterreply/pull/390) completed the machine-readable
  report and state-changing reconciliation gates.
- PRs [#464](https://github.com/moojjoo/recruiterreply/pull/464) and
  [#466](https://github.com/moojjoo/recruiterreply/pull/466) added controlled-approval test
  coverage.
- Software Factory PR
  [#7](https://github.com/moojjoo/dannellysolutions-software-factory/pull/7) added and
  validated the reusable policy and templates.

## Verified acceptance

- Pull requests distinguish partial `Refs` references from the final `Dev-Completes` marker.
- Current-head CI and CodeQL checks, an immutable merge SHA, verified Dev deployment, and a
  successful smoke step are required; missing evidence fails closed.
- The `dev-acceptance-verified` label remains a separate owner-controlled approval signal.
- Reconciliation produces JSON and Markdown artifacts, runs on schedule and after successful
  Dev deployments, and does not mutate issue state.
- The state-changing reconciler is idempotent, records the PR, workflow run, and deployed SHA,
  and updates the GitHub Project only after every gate passes.
- Automated tests cover complete, incomplete, missing-token, absent-project, missing-approval,
  stale-SHA, repeated-event, and partial-PR scenarios.
- Issues #314 and #316 were not closed by merge alone; both were completed independently.
- Test and Production promotion gates remain manual and unchanged.

## Final validation procedure

The final pull request must pass `verify`, Playwright, and `CodeQL required gate` on its exact
head SHA. After merge, the existing main-branch workflow must build and deploy the exact merge
SHA to Dev and pass its smoke verification. Only then may the owner-controlled acceptance label
allow the reconciler to close #320 and record the immutable workflow evidence.
