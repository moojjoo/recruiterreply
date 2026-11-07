# Manual review for Dependabot pull requests

The `Execute PR Automation` workflow does not auto-merge pull requests authored by exactly `dependabot[bot]`. It runs from the trusted `main` branch, removes any existing auto-merge request and the `automation-ready` label, reports that manual review is required, and exits before the normal `/execute-dev` readiness path.

Dependabot pull requests continue to run the repository's normal CI and security checks. Passing checks do not authorize a merge. The repository owner must review and merge every patch, minor, major, grouped, security, GitHub Actions, Terraform, NuGet, and npm update explicitly.

The normal issue-linked `/execute` and `/execute-dev` automation for non-Dependabot implementation pull requests is unchanged. Branch protection remains authoritative, and Test and Production promotions always require separate owner authorization.

To pause all execute PR automation, disable the `Execute PR Automation` workflow in repository Actions settings. That setting affects the entire workflow, including `/execute-dev`; it cannot target only Dependabot.
