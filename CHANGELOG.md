# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- Monorepo workspace implementation for `packages/core`, `packages/vscode`, and `packages/chrome` with strict TypeScript, build scripts, and test wiring.
- Shared core domain layer: environment management, ArcGIS REST client wrappers, filtering/sorting/expiration logic, and host/webview messaging protocol.
- Shared Lit component set for configuration, sign-in, credential list/detail, expiration badges, and key create/regenerate modal flows.
- VS Code extension implementation including TreeView commands, adapters (storage/auth/clipboard), webview bridge, and credential/key action flows.
- Contributor/agent docs and development support files (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, eslint/prettier/workspace config).
- Chrome extension baseline implementation (MV3 manifest, popup launcher, explorer tab UI, service worker, Chrome storage/auth/clipboard adapters, and build pipeline).
- Chrome OAuth local-development setup docs for unpacked extensions and `chromiumapp.org` redirect URL configuration.
- Chrome popup state unit tests for auth control visibility, enterprise field visibility, and post-sign-in explorer auto-open decision logic.

### Added

- **Core:** Added `revokeApiKey()` method to `ArcGisRestClient` interface and implementation, using the `/oauth2/revokeToken` endpoint.
- **Core:** Exposed `KeyMutationAction` type (`'create' | 'regenerate' | 'revoke'`) from `rest/types`.
- **Core:** "Revoke API key N" button added to each key slot card in `<credential-detail>`; modal closes automatically after a successful revoke.
- **Core:** `filterCredentials()` now also matches against referrer domains (case-insensitive) in addition to credential name.
- **Core:** New unit tests for create/regenerate/revoke REST flows, expiration validation, and enterprise endpoint targeting.
- **Core:** New protocol unit test confirming revoke action round-trips through serialization correctly.
- **Core:** `expiration` field on `KeySlotStatus` model for per-slot key expiration date (mapped from API token slot metadata).
- **Core:** `fetchPortalBase()` REST method resolving the org-scoped portal base URL via `/portals/self` (falls back to `arcgis.com` for Online).
- **Core:** `keyLabel` attribute on `<expiration-badge>` to prefix slot badges with K1/K2 identifiers in list rows.
- **Core:** Per-slot expiration badges (K1, K2) in `<credential-list>` rows; column header row added above credential entries.
- **Core:** Settings deep-link (↗) per credential row in `<credential-list>` that opens the ArcGIS item settings page in a new tab (requires `portalBase`).
- **Core:** `portalBase` property on `<credential-list>`; `portalBase` field added to `host/credentials` messaging protocol payload.

- **VS Code:** `executeKeyActionForEnvironment` now handles the `revoke` action and dispatches to `revokeApiKey`.
- **VS Code:** Resolves and forwards `portalBase` in the credentials payload so list rows display settings links.
- **VS Code:** Replaced generic placeholder icon with Esri-branded API keys SVG.

- **Chrome:** Explorer and service worker now handle the `revoke` action and dispatch to `revokeApiKey`.
- **Chrome:** Service worker resolves and passes `portalBase` in `host/credentials` payload.
- **Chrome:** Extension icons declared in manifest at 16/32/48/128px sizes.

### Changed

- **Core:** Key mutation flow replaced: removed dynamic `@esri/arcgis-rest-js` import fallback; all create/regenerate/revoke now use a documented flow — item owner lookup → `/registeredAppInfo` → `/items/{id}/update` (expiration) → `/oauth2/token` or `/oauth2/revokeToken`.
- **Core:** `KeyMutationResult` now includes an `action` field and `key` is optional (absent for revoke).
- **Core:** `<key-action-modal>` title, warning text, and expiration input are now action-aware (no expiration field shown for revoke).
- **Core:** Key slot labels updated to "Primary key (slot 1)" / "Secondary key (slot 2)" and button labels updated to "Generate a primary/secondary API key" for create actions.
- **Core:** Credential list search label updated to "Search Name or Referrer" with matching placeholder text.
- **Core:** `CredentialKeyActionRequest` in messaging protocol uses `KeyMutationAction` union type rather than an inline literal.
- **Core:** `<credential-list>` layout updated to Name / Keys / Details columns with unified column headers; per-slot expiration badges (K1/K2) replace the single credential-level badge.
- **Core:** `<credential-detail>` now shows expiration per key slot card; top-level expiration row hidden for new-style credentials (non-legacy).
- **Core:** `<expiration-badge>` fixes grammar: "Doesn't expires" → "Doesn't expire".

- **VS Code:** `webview-ui.ts` passes `portalBase` to `<credential-list>` element.

- **Chrome:** `copyLastKeyButton` removed from explorer page (copy functionality is handled within `<key-action-modal>`).

- Refreshed explorer UI to a compact, square-corner, Material-inspired visual style across shared components and VS Code webview shell.
- Updated webview and component theming to use VS Code theme tokens (`--vscode-*`) with cross-host fallbacks so UI automatically matches active VS Code theme/profile.
- Core package exports now separate runtime modules from component registration (`@arcgis-api-keys/core/components`) to keep service worker bundles DOM-free.

### Fixed

- Chrome popup now correctly hides the Enterprise portal URL field for non-Enterprise environment types.
- Chrome popup auth controls now reflect selected environment sign-in state (`Sign In` vs `Sign Out` / `Open Explorer`).
- Explorer tab now opens automatically after successful Chrome sign-in, and environment add/save works reliably by avoiding DOM imports in the service worker.
- Chrome manifest validation error caused by an invalid `"permissions"` permission entry; manifest now declares only valid permissions.
- ArcGIS Online/Location Platform credential loading now includes both new API token-backed credentials and legacy API keys by querying both search filters and merging results.
- Credential detail/list metadata mapping now hydrates from item + registered app info endpoints so expiration dates, privileges, tags, and key slot existence render correctly in the list/detail UI.
- Online credential loading now falls back from `/community/self` to `/portals/self` to resolve username robustly when building owner-scoped search filters.
- **Core:** Key creation no longer silently swallows expiration validation errors; missing expiration now surfaces as an `INVALID_REQUEST` error before any REST calls are made.

---

## [0.1] - 2026-02-20

### Added

- **Docs:** Functional and technical specification (`docs/SPEC.md`)
- **Docs:** Phased implementation plan (`docs/PLAN.md`)
- **Docs:** Task tracker with checkboxes (`docs/TODO.md`)
- **Tooling:** `CLAUDE.md` project memory file for Claude Code
- **Tooling:** `/ship` skill for committing and pushing changes (`.claude/skills/ship/SKILL.md`)
- **Tooling:** `/release` skill for versioned releases (`.claude/skills/release/SKILL.md`)
