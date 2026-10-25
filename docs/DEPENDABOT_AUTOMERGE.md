# Safe Dependabot auto-merge

The `Execute PR Automation` workflow may enable protected squash auto-merge for a narrow class of Dependabot pull requests. It runs from the trusted `main` branch and never checks out or executes pull-request code.

An update is eligible only when all of these are true:

- The author is exactly `dependabot[bot]`, the target is `main`, and the source repository is this repository.
- The branch identifies one of the configured `nuget`, `npm_and_yarn`, `github_actions`, or `terraform` ecosystems.
- The title/body contains parseable semantic-version metadata describing a patch or minor update.
- Changed files stay within that ecosystem's dependency allowlist.
- The pull request is not a draft, conflicted, or blocked by unresolved review threads or unmerged dependencies.
- The current head SHA has successful required checks: `verify`, `test`, the stable `CodeQL required gate`, and only the CodeQL language analyses applicable to the changed scope. Frontend-only changes require `javascript-typescript`; backend-only changes require `csharp`; shared, cross-stack, or uncertain changes require both.

Major, unclassified, spoofed, cross-repository, malformed, and out-of-allowlist updates remain open for manual review. Branch protection remains authoritative; labels do not bypass checks.

To pause all execute PR automation, disable the `Execute PR Automation` workflow in repository Actions settings. To pause one update, convert its pull request to draft or close it; review blocked or major updates manually and re-run checks after correcting the cause. Test and Production promotions are never performed by this automation.
