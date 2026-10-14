---
name: commit-msg
description: Generate a Conventional Commits message from the staged diff and commit with it. Use when the user says "write a commit message", "generate a commit", "commit my changes", or runs /commit-msg.
---

# commit-msg

Generate a commit message from staged changes and commit.

## Steps

1. Run `git diff --staged --stat` and `git diff --staged` to check for staged changes.
   - If there is no staged diff, stop immediately and tell the user to stage changes first (e.g. with `git add`). Do not commit, and do not fall back to unstaged changes.
2. Read the staged diff to understand what changed and why.
3. Generate a commit message in this exact format:

   ```
   type(scope): short subject

   - bullet of what changed
   - bullet of why
   ```

   - `type` is one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`.
   - `scope` is a short identifier for the affected area (directory, module, or component name) — omit the `(scope)` parens only if no single scope fits.
   - Subject line (including `type(scope): `) must be under 60 characters, imperative mood, no trailing period.
   - Body bullets are optional but encouraged — include them when the diff is non-trivial. Keep bullets factual and grounded in the actual diff content, not speculative.
   - Never include a `Co-Authored-By` trailer or any other attribution trailer.

4. Run `git commit -m` with that message (use a heredoc if multi-line, per normal git commit conventions).
5. Report the resulting commit hash/summary back to the user.

## Notes

- Do not stage additional files — only commit what is already staged.
- Do not amend existing commits; always create a new commit.
- If the staged diff is large or spans unrelated concerns, still produce a single best-fit commit message rather than splitting the commit, unless the user asks otherwise.
