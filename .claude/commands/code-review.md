---
description: Review current uncommitted changes with the project's code-reviewer subagent
---

Use the Agent tool with `subagent_type: code-reviewer` to review the current uncommitted changes in this project. Run it in the foreground (you need its report to respond). Pass along any extra instructions from `$ARGUMENTS`, if present. Present the resulting markdown report back to the user as-is — do not summarize it away or apply any of its suggested fixes.
