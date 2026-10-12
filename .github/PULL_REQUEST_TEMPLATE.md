## Implementation evidence
Describe the implementation, commits, tests and verification workflow links. Do not claim a check passed without evidence.

## Acceptance criteria
- [ ] All issue acceptance criteria implemented and verified
- [ ] CI, CodeQL and applicable security checks pass on current SHA
- [ ] Dev deployment and smoke tests verified on the final merged SHA

## Issue linking
Use `Refs #123` for partial implementation. Only the final PR that fully satisfies an issue may include `Dev-Completes: #123`.

## Closure approval
The issue must have the separately controlled `dev-acceptance-verified` label before the post-Dev-deployment reconciler can close it. A successful build or merge does not grant approval.
