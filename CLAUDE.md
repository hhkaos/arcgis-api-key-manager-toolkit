# CLAUDE.md

## Project Overview

ArcGIS API Key Explorer — a VS Code extension and Chrome extension for securely managing ArcGIS API Key credentials. Users can browse, search, filter, and rotate API keys across ArcGIS Online, Location Platform, and Enterprise environments.

## Architecture

Monorepo with npm workspaces and three packages:

- `packages/core/` — Shared business logic, REST client, Lit web components, data model
- `packages/vscode/` — VS Code extension (CommonJS)
- `packages/chrome/` — Chrome extension (Manifest V3, ESM)

## Key Technologies

- **TypeScript** (strict mode, ES2020+)
- **Lit** for shared web components (used in VS Code WebViews and Chrome tabs)
- **@esri/arcgis-rest-js** for ArcGIS REST API calls
- **esbuild** for bundling
- **OAuth 2.0** with Authorization Code + PKCE flow

## Build & Run

```bash
npm install                              # install all workspace dependencies
npm run build --workspace=packages/core  # build core first
npm run build --workspace=packages/vscode
npm run build --workspace=packages/chrome
npm test                                 # run tests from repo root
```

Build order matters: core must be built before vscode and chrome.

## Project Documentation

- `docs/SPEC.md` — Full functional and technical specification
- `docs/PLAN.md` — Implementation plan (phased)
- `docs/TODO.md` — Task tracker with checkboxes

## Commit Conventions

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Scope to package when applicable: `feat(core):`, `fix(vscode):`, `chore(chrome):`
- The user has two git aliases for committing:
  - `git cai` — AI-attributed commit (author: "AI Generated (hhkaos)")
  - `git ch` — Regular commit with user's default identity
- Always ask which alias to use before committing
- Never use `git add -A` or `git add .`; stage files by name

## Shipping Changes

Use the `/ship` skill to commit and push. It handles: tests, changelog, TODO updates, staging, commit message, alias selection, and push.

Use the `/release` skill for versioned releases with tags and GitHub Releases.

## Important Patterns

- No bundled secrets — users provide their own OAuth client IDs
- Client-only architecture (no backend server)
- Tokens cached per environment; switching environments doesn't require re-auth
- Read-only access to credentials (no admin/org-wide management in v1)
- Update `CHANGELOG.md`, `docs/TODO.md`, and `docs/SPEC.md` (if relevant) with every commit
