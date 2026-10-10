# RecruiterReply Copilot Instructions

Work in the `moojjoo/recruiterreply` repository. Inspect relevant code and follow established project conventions before changes.

## Feature workflows

- When asked for a **new feature**, brainstorm requirements and acceptance criteria before creating an issue; use `.github/prompts/feature.prompt.md` when present.
- When asked to **execute issue <number>**, follow the execution workflow in `.github/prompts/execute.prompt.md`. The explicit `/execute` prompt is the reliable invocation method; natural-language routing is best effort.
- Assign new feature issues to `moojjoo` and add them to `@moojjoo's recruiterreply project` when tooling supports it. Report failures.
- For `/execute <issue-number>`, the user authorizes merge to `main` **only after required checks pass** and deployment to **dev** through existing `.github/workflows/build.yml` and `.github/workflows/promote.yml`. Verify the deployment result; never bypass protections.
- Test and production promotion require separate explicit approval and must use the existing `promote-test.yml` and `promote-prod.yml` workflows with a verified commit SHA.
- Never introduce AWS recurring costs, change secrets, or make unrelated live infrastructure changes without approval.
