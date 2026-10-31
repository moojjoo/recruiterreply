## Implementation evidence
Describe the implementation, commits, tests and verification workflow links. Do not claim a check passed without evidence.

## Acceptance criteria
- [ ] All issue acceptance criteria implemented and verified
- [ ] CI, CodeQL and applicable security checks pass on current SHA
- [ ] Dev deployment and smoke tests verified on the final merged SHA

## Issue linking
Use `Refs #123` for partial implementation. Only the final PR that fully satisfies an issue may include `Dev-Completes: #123`.

## Closure approval
The trusted post-Dev-deployment reconciler applies `dev-acceptance-verified` only after the final PR checks, deployed SHA, smoke verification and project membership checks pass. A successful build or merge alone does not close the issue.
