# AGENTS.md

## Project Memory

### Project Overview
ArcGIS API Key Explorer is a VS Code extension and Chrome extension for securely managing ArcGIS API key credentials. Users can browse, search, filter, and rotate keys across ArcGIS Online, Location Platform, and Enterprise environments.

### Architecture
Monorepo with npm workspaces and three packages:
- `packages/core/` — shared business logic, REST client, Lit web components, data model
- `packages/vscode/` — VS Code extension (CommonJS)
- `packages/chrome/` — Chrome extension (Manifest V3, ESM)

### Key Technologies
- TypeScript (strict mode, ES2020+)
- Lit for shared web components (used in VS Code WebViews and Chrome tabs)
- `@esri/arcgis-rest-js` for ArcGIS REST API calls
- esbuild for bundling
- OAuth 2.0 Authorization Code + PKCE flow

### Build And Run
```bash
npm install
npm run build --workspace=packages/core
npm run build --workspace=packages/vscode
npm run build --workspace=packages/chrome
npm test
```
Build order matters: build `packages/core` before `packages/vscode` and `packages/chrome`.

### Project Documentation
- `docs/SPEC.md` — functional and technical spec
- `docs/PLAN.md` — implementation plan
- `docs/TODO.md` — task tracker

### Commit Conventions
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Scope when relevant: `feat(core):`, `fix(vscode):`, `chore(chrome):`
- Commit aliases:
  - `git cai` for AI-attributed commits
  - `git ch` for regular user-identity commits
- Ask which alias to use before committing
- Stage files explicitly by name; do not use `git add -A` or `git add .`

### Shipping
Use the `ship` skill when the user asks to commit and push. It covers tests, changelog/TODO updates, staging, commit message, alias selection, and push.

### Important Patterns
- No bundled secrets; users provide their own OAuth client IDs
- Client-only architecture (no backend server)
- Cache tokens per environment; environment switching should not require re-authentication
- Read-only access to credentials in v1 (no org-wide admin management)
- Update `CHANGELOG.md`, `docs/TODO.md`, and `docs/SPEC.md` (when relevant) with each commit
- If expiration date lookup via `https://www.arcgis.com/sharing/rest/portals/self/apiTokens` fails, it may require username/password-based auth in that context; pause and ask the user how to proceed before forcing an auth-mode change.

### UI State & Regression Guardrails
- Do not infer intended visibility from implementation; confirm the expected behavior from user wording and existing sibling UI behavior.
- For visibility bugs, verify all auth states explicitly: `checking`, `logged-out`, `logging-in`, `logged-in`, `logging-out`.
- For explorer screens, verify both views explicitly: list view and detail view.
- Avoid forcing visible state with inline style when default display should apply; prefer removing inline `display` when showing and setting `display: none` when hiding.
- When changing one surface (Chrome or VS Code), check the corresponding surface for parity unless user explicitly asks for divergence.
- Before reporting completion, run at least package-level build for touched workspace(s) and include a short regression checklist in the update (state matrix + view matrix).
