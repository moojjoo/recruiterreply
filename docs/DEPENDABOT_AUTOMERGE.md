# Safe Dependabot maintenance

Dependabot version updates are staggered by ecosystem in
`.github/dependabot.yml`. Compatible npm and NuGet patch/minor updates are
grouped, while majors remain separate. Version-update cooldowns do not delay
Dependabot security updates.

The trusted-default-branch `Execute PR Automation` workflow may enable GitHub
protected squash auto-merge only when all of these conditions hold:

- the author is exactly `dependabot[bot]`;
- the base and head repositories are this repository and the target is `main`;
- the branch is a configured npm or NuGet Dependabot branch;
- trusted title/body metadata describes a forward patch or minor SemVer update;
- every changed file is an added or modified manifest/lock file for that ecosystem;
- the PR is not a draft and has no blocking review or unresolved thread;
- all required checks succeeded for the exact current head SHA; and
- the head SHA is re-read unchanged immediately before requesting auto-merge.

Major, GitHub Actions, Terraform, malformed, cross-repository, out-of-allowlist,
deleted/renamed-file, failed-check, and changed-head updates require manual
review. Labels and PR text cannot bypass this policy. The workflow runs from
trusted `main`, never checks out or executes pull-request code, and receives
only its explicit token permissions. Dependabot PR validation receives GitHub's
restricted Dependabot token behavior and no ordinary Actions secrets.

## CI load controls

Schedules use America/New_York and run on Monday (NuGet), Tuesday (npm),
Wednesday (GitHub Actions), and Thursday (Terraform). Open-PR limits bound queue
growth. Build and Playwright workflows cancel superseded non-main runs while
main builds remain serialized so shared-EC2 Dev deployment cannot race.

## Operations and rollback

Convert an update to draft or close it to prevent auto-merge. Disable
`Execute PR Automation` to pause all merge evaluation. Roll back by reverting
the issue #605 PR; do not weaken branch rules, required checks, or Test/Production
approval gates. Test and Production promotions are never performed by this
automation.
