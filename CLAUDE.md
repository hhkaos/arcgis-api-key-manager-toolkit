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
- **@esri/arcgis-rest-js** installed but not used for key mutation flows (direct REST calls only)
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
  - `git cai` — AI-attributed commit: sets author to "AI Generated (hhkaos)" and prepends "AI: " to the message
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
- If expiration date lookup via `https://www.arcgis.com/sharing/rest/portals/self/apiTokens` fails, it may require username/password-based auth in that context; pause and ask the user how to proceed before forcing an auth-mode change.

## Key Implementation Details

- **Portal base URL:** derived from `urlKey` + `customBaseUrl` in `/portals/self`; falls back to `https://{urlKey}.maps.arcgis.com` when `customBaseUrl` is absent. Enterprise uses `portalUrl` directly.
- **Slot partial IDs:** displayed as `AT{slot}_{last 8 chars of client_id}` (e.g. `AT1_a1b2c3d4`). Derived from registered app `client_id`, not from API token fields.
- **Key mutation flow:** item owner lookup → `/registeredAppInfo` → `/items/{id}/update` (expiration) → `/oauth2/token` or `/oauth2/revokeToken`. No `@esri/arcgis-rest-js` key mutation calls.
- **External links in VS Code webview:** anchor clicks are intercepted in `webview-ui.ts` and posted as `webview/open-external-url` messages; the extension host validates the scheme (http/https only) and opens via `vscode.env.openExternal`. Never let the webview navigate directly.
- **Theming:** all colors use VS Code theme tokens (`--vscode-*`) with `--akm-*` design tokens as the semantic layer. No hardcoded hex colors in components.
- **`portalBase` propagation:** must be set on both `<credential-list>` and `<credential-detail>` whenever credentials are loaded or cleared.

## UI State & Regression Guardrails

- Do not infer intended visibility from current code; confirm expected behavior from user request and parallel UI surfaces.
- For visibility/state issues, verify each auth state explicitly: `checking`, `logged-out`, `logging-in`, `logged-in`, `logging-out`.
- For explorer UI, verify both contexts: list view and detail view.
- Avoid sticky inline display forcing for controls that should use natural/default display: remove inline `display` when visible, set `display: none` only when hidden.
- If a change targets Chrome (or VS Code), check for parity/regression in the corresponding VS Code (or Chrome) UI unless divergence is explicitly requested.
- Before closing a UI fix, run package-level build for touched workspace(s) and report a concise regression checklist (states checked + views checked).
