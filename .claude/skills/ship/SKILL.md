---
name: ship
description: Run tests, stage changes, generate a commit message, commit using a git alias, and push
disable-model-invocation: true
---

Follow these steps to commit changes:

## 1. Review changes

Run `git status` (never use `-uall`) and `git diff` (both staged and unstaged) to understand all current changes.

## 2. Run tests

Run `npm test` from the repo root. If tests fail, stop and inform the user. Do not proceed to staging or committing until tests pass.

## 3. Update project documentation

Review the changes and update the following files as needed:

### CHANGELOG.md

Read `CHANGELOG.md` and add an entry under the `[Unreleased]` section describing the change. Place it under the appropriate subsection (`Added`, `Changed`, `Fixed`, `Removed`). Create the subsection if it doesn't exist. Keep entries concise (one bullet point per logical change). Each entry MUST specify which package it applies to at the start of the bullet point so readers know the scope at a glance:

- **Core:** — shared core package (`packages/core`)
- **VS Code:** — VS Code extension (`packages/vscode`)
- **Chrome:** — Chrome extension (`packages/chrome`)
- **All:** — changes affecting all packages
- **Docs:** — documentation-only changes
- **Tooling:** — build tooling, CI, linting, etc.

### docs/TODO.md

Read `docs/TODO.md` and update checkboxes to reflect the current state of the project:

- Mark completed tasks as `[x]`
- Mark in-progress tasks as `[~]`
- Only modify items directly related to the current changes

### docs/SPEC.md

Read `docs/SPEC.md` and update it only if the changes affect the technical specification. For example:

- New or changed features that alter the documented architecture or behavior
- Updated technology choices or dependencies
- Skip this file if the changes are purely internal (refactoring, tests, tooling)

## 4. Stage files

Stage the relevant files by name, including any updated documentation files (`CHANGELOG.md`, `docs/TODO.md`, `docs/SPEC.md`). Never use `git add -A` or `git add .`. Never stage files that may contain secrets (`.env`, credentials, private keys, etc.) — warn the user if any are detected.

## 5. Generate a commit message

- Run `git log --oneline -10` to see recent commit style.
- Analyze the staged diff and draft a concise conventional commit message (e.g. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- For changes scoped to a single package, use the conventional commit scope: `feat(core):`, `fix(vscode):`, `chore(chrome):`.
- Focus on the "why" rather than the "what".
- Keep it to 1-2 sentences.
- Show the proposed message to the user before committing.

## 6. Choose the git alias

Ask the user which alias to use:

- **`git cai`** — AI-attributed commit (sets author to "AI Generated (hhkaos)" and prefixes the message with "AI: ")
- **`git ch`** — Regular commit with the user's default git identity

## 7. Commit

Run the chosen alias with the commit message. For example:

- `git cai "feat(core): add expiration categorization logic"`
- `git ch "fix(vscode): handle token expiry during key regeneration"`

## 8. Push

Run `git push`. If the branch has no upstream, use `git push -u origin <branch>`.
