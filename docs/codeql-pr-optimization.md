# CodeQL pull-request optimization (issue #354)

The CodeQL workflow retains **both** C# and JavaScript/TypeScript analysis for every push to `main`. Pull requests to `main` select a smaller language matrix only when *all* changed paths (including rename source paths) are confidently in a single component:

| Changed files | CodeQL analysis |
| --- | --- |
| `frontend/**` only | JavaScript/TypeScript |
| `backend/**` only | C# |
| Both directories | Both |
| Any root, infrastructure, docs, workflow, or otherwise unclassified path | Both |
| File-list failure, empty list, or 3,000-file cap | Both |
| Push to `main` | Both |

This is intentionally conservative. GitHub's PR-files API is read with `pull-requests: read` permission. The selector does not check out or execute PR code and does not use `pull_request_target`. The analysis job retains `security-events: write` for CodeQL uploads. No manual build is configured (`build-mode: none`).

## Required-check migration

**Before merging this change**, inspect repository rulesets and branch protection. The old per-language checks may be required as `CodeQL / analyze (csharp)` or `CodeQL / analyze (javascript-typescript)`. Those checks will be intentionally absent when their language is skipped, and would block merging if still required. Replace the old per-language required checks with the new stable **`CodeQL / CodeQL required gate`** after the gate appears in PR checks; retain any other security checks. Do not weaken branch protection or merge while required checks are pending. If ruleset changes cannot be made, do not merge this PR.

The repository ruleset must use the CodeQL `code_scanning` merge-protection rule together with the stable **`CodeQL / CodeQL required gate`** status check. Do not enable a `code_quality` ruleset rule unless a separate CodeQL Code Quality workflow is configured; the security workflow's SARIF upload does not satisfy that different result type. An unsupported `code_quality` rule causes GitHub to show a neutral CodeQL result and block otherwise successful frontend-only pull requests.

The gate runs with `if: always()` and succeeds only when language selection and all selected CodeQL analyses succeeded. No successful analysis means no successful gate.

## Runtime measurement

The CodeQL analysis job reports total elapsed seconds in the GitHub Actions job summary. Compare a frontend-only PR against historical PR runs, and check the CodeQL action step timings to identify initialization vs analysis costs. The optimization avoids the C# job on frontend-only PRs rather than trying to cache buildless extraction.

## Validation scenarios

1. Frontend-only PR: selector emits `["javascript-typescript"]`; gate succeeds after JS analysis.
2. Backend-only PR: selector emits `["csharp"]`; gate succeeds after C# analysis.
3. Mixed PR: both analyses run.
4. Workflow, infrastructure, docs or root changes: both analyses run.
5. Push to main: both analyses run.
6. Failed selector or failed analysis: gate fails.

Do not merge until the GitHub Actions run demonstrates the expected matrix and required-check behavior.
