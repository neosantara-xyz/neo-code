---
inclusion: auto
name: neo-code-workflows
description: Use for Neo Code changes, verification, release bumping, issue or PR handling, and safe git workflow in this repository.
---

# Neo Code Workflows

Development workflow:

1. Inspect the exact relevant files before wide changes.
2. Keep changes scoped to the requested surface.
3. For behavior changes, prefer focused package-root tests when relevant.
4. Run `npm run check` after non-doc code changes.
5. Run `npm run bump -- patch --notes "<type(area): effect>"` after verified non-doc fixes/features unless told not to bump.
6. Do not commit unless explicitly asked.

Safe git workflow:

- Never run `git add -A`, `git add .`, `git reset --hard`, `git checkout .`, `git clean -fd`, or `git stash`.
- Only stage files changed in the current session.
- If committing for an issue, include `fixes #<number>` or `closes #<number>`.
- If rebase conflicts occur in files not modified in the current session, stop and ask.

Issue/PR comments:

- Write the full comment to a temp file.
- Preview the exact text.
- Post with `gh issue comment --body-file` or `gh pr comment --body-file`.
- Post one final concise technical comment unless asked otherwise.

Reference:

#[[file:AGENTS.md]]

