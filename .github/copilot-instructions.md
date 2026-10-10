# RecruiterReply Copilot Instructions

Work in the `moojjoo/recruiterreply` repository. Inspect relevant code and follow established project conventions before changes.

## Feature workflows

- When asked for a **new feature**, brainstorm requirements and acceptance criteria before creating an issue; use `.github/prompts/feature.prompt.md` when present.
- When asked to **execute issue <number>**, follow the execution workflow in `.github/prompts/execute.prompt.md`. The explicit `/execute` prompt is the reliable invocation method; natural-language routing is best effort.
- Assign new feature issues to `moojjoo` and add them to `@moojjoo's recruiterreply project` when tooling supports it. Report failures.
- Never merge or deploy without explicit approval. Never introduce AWS recurring costs or change secrets without approval.
