# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.1.0] - 2026-02-23

### Added

- **Core:** `environmentType` property on `<credential-list>` — renders a `chart-line` usage icon column linked to `https://location.arcgis.com/usage/credentials/{id}/` for each row when environment type is `location-platform`; added "View Usage" link in `<credential-detail>` header for Location Platform environments; added `chart-line` icon to `<akm-icon>`.

- **VS Code:** Propagated `environmentType` to `<credential-list>` on credential load and clear.

- **Chrome:** Propagated `environmentType` to `<credential-list>` on credential load and clear.

- **Core:** New `<akm-icon>` Lit web component backed by Font Awesome SVG icons (`@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`); exported from `@arcgis-api-keys/core/components`.

- **VS Code:** `shouldShowSignInDisclaimer()` utility extracted to `ui-state.ts`; added `setInlineControlVisibility()` / `setFlexControlVisibility()` helpers for proper `inline-flex` / `flex` layout when icons are nested in buttons and banners.

- **Chrome:** `shouldShowSignInDisclaimer()` utility extracted to `ui-state.ts`; same visibility helpers added to `explorer.ts`.

### Changed

- **Core:** Replaced all emoji/Unicode icon characters (⚠️ ✎ ↗ ← ✓ ✕ × ℹ 🏷️) across `<credential-detail>`, `<credential-list>`, `<expiration-badge>`, `<key-action-modal>`, and `<sign-in-view>` with `<akm-icon>` SVG elements; pencil, close, and chip-remove buttons converted to fixed-size `inline-flex` containers for consistent alignment.
- **Core:** Updated `<credential-list>` toolbar UX to a compact basic mode with collapsible advanced options; added a `Favorites only` quick filter toggle, a dedicated favorite-star column in list rows, and `favorites` support in `CredentialFilter`/`filterCredentials()`.
- **Core:** Updated `<credential-detail>` “Open in Portal” link text to include an explicit external-link icon for clearer affordance.

- **VS Code:** Updated webview shell (`webview-ui.ts`) — disclaimer banner, action buttons (Sign in, Sign out, Refresh, Back), and "Create API key" link now use `<akm-icon>`; `setupButton` / `setupPrimaryLink` extended with optional icon name and position arguments.

- **Chrome:** Updated `explorer.ts` and `popup.html` — all buttons, the disclaimer banner, and the "Add Environment" summary/save button now use `<akm-icon>`; `ui.css` extended with `.disclaimer-content`, `.disclaimer-icon`, `button.with-icon`, and `.summary-with-icon` layout rules.

### Added

- **Core:** Disclaimer banner and acknowledgement checkbox in `<sign-in-view>`; sign-in button is disabled until the user acknowledges the "not an official Esri project" notice.

- **VS Code:** Disclaimer banner in the webview shell (visible only on the sign-in screen); moved "Create API key ↗" link management into a new `syncHeaderActions()` helper so the link is only rendered when the user is logged in.

- **Chrome:** Disclaimer banner in the popup and full-tab explorer (shown on sign-in screen only); popup acknowledgement persisted in `localStorage` so users don't need to re-check on each open. Added `.disclaimer`, `.checkbox-field`, and `.hint` CSS classes to `ui.css`.
- **Chrome:** Environment type dropdown in the popup now shows `name (Type)` (e.g. `hhkaos (ArcGIS Location Platform)`) via new `formatEnvironmentOptionLabel` / `formatEnvironmentTypeLabel` helpers in `popup-state.ts`.
- **Chrome:** "ArcGIS Enterprise" option in the Add Environment form renamed to `ArcGIS Enterprise (Coming soon)` and disabled; a `.hint` note below the type selector links to the GitHub issues page to collect community interest.
- **Chrome:** `SESSION_EXPIRED` error in the full-tab explorer now silently transitions to the signed-out state (hides credential list, shows sign-in screen) matching VS Code behaviour.

- **Docs:** Added "not an official Esri project" warning notice to README.

- **Core:** `isDeleteProtected` and `isFavorite` fields on `ApiKeyCredential`; `fetchCredentialDetail()` now populates both by fetching `/portals/self` (for `favGroupId`) and querying `/search` to check favorite group membership.
- **Core:** `toggleItemDeleteProtection()`, `canDeleteCredential()`, `deleteCredential()`, and `toggleCredentialFavorite()` REST methods; corresponding option interfaces and `ArcGisRestClient` entries in `types.ts`.
- **Core:** Protocol messages for delete and favorite flows — `webview/toggle-credential-delete-protection`, `webview/toggle-credential-favorite`, `webview/check-credential-delete`, `webview/delete-credential` (webview→host); `host/credential-delete-check-result`, `host/credential-deleted` (host→webview).
- **Core:** Delete protection toggle (switch widget) and favorite toggle (switch widget) in `<credential-detail>`; delete button that opens a confirmation modal (fetches `canDelete` before revealing the destructive action).
- **Core:** `resolveItemOwner()` private helper extracted from `resolveRegisteredAppCredentials()` and reused by the four new REST methods.

- **VS Code:** "Create API key ↗" link in the app header (derived from `portalBase`; only shown for ArcGIS Online/Location Platform environments).
- **VS Code:** Handlers for `webview/toggle-credential-delete-protection`, `webview/toggle-credential-favorite`, `webview/check-credential-delete`, and `webview/delete-credential` messages; post `host/credential-metadata-updated`, `host/credential-delete-check-result`, or `host/credential-deleted` in response.
- **VS Code:** Fixed `handleExternalLinkClick` to mark events as handled in capture phase, preventing double-dispatch when the header actions container also listens at capture.

- **Chrome:** "Create API key ↗" link in the app header (same logic as VS Code).
- **Chrome:** Wired `credential-delete-protection-toggle-request`, `credential-favorite-toggle-request`, `credential-delete-check-request`, and `credential-delete-execute-request` event listeners in explorer; added corresponding cases in service worker.

- **Core:** `environmentType` property on `<credential-detail>` — renders an environment-specific "View privilege reference ↗" link (ArcGIS Online, Location Platform, or Enterprise docs) in the Privileges section.
- **Core:** "Instructions" toggle button in the inline referrer editor replaces the `<details>` collapsible panel; added `button.secondary` and `button.full-width` CSS utility classes.
- **Core:** Inline referrer restrictions editor in `<credential-detail>` — "Edit referrers" button reveals an add/edit/delete form with per-row validation annotations; dispatches `credential-referrers-update-request` event on save.
- **Core:** `updateCredentialReferrers()` REST method — looks up item owner and registered app info, then PATCH-updates the app's `httpReferrers` via `/oauth2/apps/{clientId}/update` while preserving existing `redirect_uris` and `privileges`.
- **Core:** `webview/update-credential-referrers` webview→host protocol message; response reuses `host/credential-metadata-updated`.
- **Core:** `snippet` field on `ApiKeyCredential` model; populated from the `/content/items/{id}/groups` response during `fetchCredentialDetail()`.
- **Core:** `fetchUserTags()` REST method — fetches the authenticated user's tags from `/community/users/{id}/tags` for tag autocomplete.
- **Core:** `updateItemMetadata()` REST method — updates item title, snippet, and tags via `/content/users/{owner}/items/{id}/update`.
- **Core:** Inline editing for title, snippet, and tags in `<credential-detail>` with pencil-button reveal on hover, focus-out auto-save, and tag combobox with type-ahead suggestions from the user's existing tags.
- **Core:** Inline editing for title, snippet, and tags in `<credential-list>` rows; credential rows converted from `<button>` to `<div role="button">` to allow nested interactive controls.
- **Core:** `webview/fetch-user-tags` and `webview/update-credential-metadata` webview→host protocol messages; `host/user-tags` and `host/credential-metadata-updated` host→webview messages.

- **VS Code:** Propagates active environment type to `<credential-detail>` via `environmentType` on `host/state` message handling.
- **VS Code:** `updateCredentialReferrersForEnvironment()` handler — calls `updateCredentialReferrers()`, re-fetches the updated credential, and posts `host/credential-metadata-updated` back to the webview.
- **VS Code:** `fetchUserTagsForEnvironment()` handler posts available tags to the webview on demand.
- **VS Code:** `updateCredentialMetadataForEnvironment()` handler — calls `updateItemMetadata()`, re-fetches the updated credential, and posts `host/credential-metadata-updated` back to the webview.

- **Chrome:** Propagates active environment type to `<credential-detail>` on `state` message handling.
- **Chrome:** Wired `fetch-user-tags`, `credential-update-request`, and `credential-referrers-update-request` event listeners in explorer; added `webview/fetch-user-tags`, `webview/update-credential-metadata`, and `webview/update-credential-referrers` cases in service worker.

### Changed

- **All:** Updated disclaimer text across all sign-in surfaces to be shorter and more personal ("experimental side project created for fun and personal use"); shortened the GitHub issues link to just "issues".

- **VS Code:** Completed acknowledgement checkbox gate in the webview shell (`webview-ui.ts`); sign-in button is now disabled until the user checks the "I have read the warning" checkbox (was missing from previous commit).

- **Chrome:** Completed acknowledgement checkbox gate in the full-tab explorer (`explorer.ts`); sign-in button is now disabled until the user checks the acknowledgement checkbox (was missing from previous commit).

- **Core:** Reordered `<credential-detail>` sections — API Key Slots first, Privileges second, Referrer Restrictions third, Metadata last.
- **Core:** "Edit referrers" button moved below the referrer list and changed to full-width.
- **Core:** `<credential-list>` column sizing extracted to `--akm-credential-columns` CSS custom property and `box-sizing: border-box` applied to header/row for consistent layout.
- **Core:** `filterCredentials()` search now also matches against partial API key IDs (e.g. `AT1_a1b2c3d4`).
- **Core:** `<credential-list>` search label updated to "Search" with an info tooltip listing supported fields: Name, Referrer, or Partial API Key.

### Fixed

- **CI/Tests:** Updated `packages/core` and `packages/vscode` test scripts to run Node test discovery from `dist-test/test` (`cd dist-test/test && node --test`) so GitHub Actions on Node 20 does not treat a quoted glob as a literal path.

---

## [1.0.0] - 2026-02-22

### Added

- **Release:** GitHub Actions `release.yml` workflow — triggered on `v*.*.*` tag push (or `workflow_dispatch`); builds all packages, runs tests, packages `.vsix` via `@vscode/vsce` and Chrome `.zip`, then creates a GitHub Release with both artifacts attached.
- **VS Code:** `.vscodeignore` to exclude `src/`, `scripts/`, `dist-test/`, `tsconfig*.json`, and source maps from the `.vsix` bundle.
- **VS Code:** `package` script (`npx @vscode/vsce package --no-dependencies`) in `packages/vscode/package.json`.
- **Root:** `package:vscode` and `package:chrome` convenience scripts for local packaging.

- Monorepo workspace implementation for `packages/core`, `packages/vscode`, and `packages/chrome` with strict TypeScript, build scripts, and test wiring.
- Shared core domain layer: environment management, ArcGIS REST client wrappers, filtering/sorting/expiration logic, and host/webview messaging protocol.
- Shared Lit component set for configuration, sign-in, credential list/detail, expiration badges, and key create/regenerate modal flows.
- VS Code extension implementation including TreeView commands, adapters (storage/auth/clipboard), webview bridge, and credential/key action flows.
- Contributor/agent docs and development support files (`README.md`, `CONTRIBUTING.md`, `AGENTS.md`, eslint/prettier/workspace config).
- Chrome extension baseline implementation (MV3 manifest, popup launcher, explorer tab UI, service worker, Chrome storage/auth/clipboard adapters, and build pipeline).
- Chrome OAuth local-development setup docs for unpacked extensions and `chromiumapp.org` redirect URL configuration.
- Chrome popup state unit tests for auth control visibility, enterprise field visibility, and post-sign-in explorer auto-open decision logic.

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
- **Core:** `portalBase` property on `<credential-detail>`; "Open API Key settings in ArcGIS ↗" button in the detail panel header when `portalBase` is available.
- **Core:** `webview/open-external-url` message type added to WebView → Host protocol; unit test confirms round-trip serialization.

- **VS Code:** `executeKeyActionForEnvironment` now handles the `revoke` action and dispatches to `revokeApiKey`.
- **VS Code:** Resolves and forwards `portalBase` in the credentials payload so list rows display settings links.
- **VS Code:** Replaced generic placeholder icon with Esri-branded API keys SVG.
- **VS Code:** `webview/open-external-url` messages handled by extension host via `vscode.env.openExternal` with URL scheme validation (http/https only).

- **Chrome:** Explorer and service worker now handle the `revoke` action and dispatch to `revokeApiKey`.
- **Chrome:** Service worker resolves and passes `portalBase` in `host/credentials` payload.
- **Chrome:** Extension icons declared in manifest at 16/32/48/128px sizes.

### Changed

- **VS Code:** `publisher` updated from `local-dev` to `hhkaos` in `packages/vscode/package.json`.

- **Core:** Expiration badge states (ok/warning/critical/expired) now use VS Code theme tokens (`--vscode-editor-foreground`, `--vscode-editorWarning-foreground`, `--vscode-errorForeground`) instead of hardcoded colors; badges use a neutral theme-background surface; emoji prefixes (✓ / ⚠ / ✕) convey status without relying on background color.
- **Core:** Credential detail slot cards use `--akm-surface-raised` / `--akm-border` instead of hardcoded `#ffffff` / `#d9e1e8`; warning referrer border uses `--vscode-editorWarning-foreground`; "Review" label uses theme warning color; action button labels prefixed with `↺` / `✕` / `+` symbols; regenerate/revoke buttons styled with `--vscode-errorForeground` on a theme-background surface instead of hardcoded dark reds.
- **Core:** Key mutation flow replaced: removed dynamic `@esri/arcgis-rest-js` import fallback; all create/regenerate/revoke now use a documented flow — item owner lookup → `/registeredAppInfo` → `/items/{id}/update` (expiration) → `/oauth2/token` or `/oauth2/revokeToken`.
- **Core:** `KeyMutationResult` now includes an `action` field and `key` is optional (absent for revoke).
- **Core:** `<key-action-modal>` title, warning text, and expiration input are now action-aware (no expiration field shown for revoke).
- **Core:** Key slot labels updated to "Primary key (slot 1)" / "Secondary key (slot 2)" and button labels updated to "Generate a primary/secondary API key" for create actions.
- **Core:** Credential list search label updated to "Search Name or Referrer" with matching placeholder text.
- **Core:** `CredentialKeyActionRequest` in messaging protocol uses `KeyMutationAction` union type rather than an inline literal.
- **Core:** `<credential-list>` layout updated to Name / Keys / Details columns with unified column headers; per-slot expiration badges (K1/K2) replace the single credential-level badge.
- **Core:** `<credential-detail>` now shows expiration per key slot card; top-level expiration row hidden for new-style credentials (non-legacy).
- **Core:** `<expiration-badge>` fixes grammar: "Doesn't expires" → "Doesn't expire".

- **VS Code:** Webview panel title changed from "ArcGIS API Keys - {env}" to "{env} API keys".
- **VS Code:** Session expiry (`SESSION_EXPIRED`) now silently transitions to the logged-out state — hides the credential list, shows the sign-in button, and removes the redundant error banner.
- **VS Code:** Credential list visibility fixed: uses `style.display` instead of the `hidden` attribute so it reliably hides inside custom elements regardless of shadow DOM CSS.
- **VS Code:** Error messages no longer include the raw error code suffix.
- **VS Code:** `webview-ui.ts` passes `portalBase` to `<credential-list>` element.
- **VS Code:** `portalBase` now forwarded to `<credential-detail>` as well; anchor clicks inside the webview are intercepted and posted as `webview/open-external-url` messages rather than navigating inline.

- **Chrome:** `copyLastKeyButton` removed from explorer page (copy functionality is handled within `<key-action-modal>`).
- **Chrome:** `portalBase` now forwarded to `<credential-detail>` in addition to `<credential-list>`.

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

- **Core:** Slot card partial IDs now always derive from the registered app `client_id` using the pattern `AT{slot}_{last 8 chars}` instead of absent API fields, so they display correctly instead of showing N/A.
- **Core:** Fixed `computePartialId` reading `client_id` from the top-level merged record rather than the `pickSourceRecord`-narrowed source, which could strip the field when a legacy credential wrapper was present.
- **Core:** Removed "Created: N/A" row from slot cards — creation date is not available from the API.
- **Core:** `fetchPortalBase()` now derives the org portal URL from `urlKey` + `customBaseUrl` in `/portals/self` instead of the org `id`; falls back to `https://{urlKey}.maps.arcgis.com` when `customBaseUrl` is absent.
- **Core:** `<key-action-modal>` warning box, result panel, toast, and destructive button colors replaced with VS Code theme tokens (`--vscode-editorWarning-foreground`, `--vscode-errorForeground`, `--akm-surface-raised`); ⚠ prefix on warning text; ✓ prefix on "Copied!" confirmation.
- **Core:** API key expiration timestamp milliseconds set to `0` (was `999`) to avoid off-by-one second issues in timestamp comparisons.

---

## [0.1] - 2026-02-20

### Added

- **Docs:** Functional and technical specification (`docs/SPEC.md`)
- **Docs:** Phased implementation plan (`docs/PLAN.md`)
- **Docs:** Task tracker with checkboxes (`docs/TODO.md`)
- **Tooling:** `CLAUDE.md` project memory file for Claude Code
- **Tooling:** `/ship` skill for committing and pushing changes (`.claude/skills/ship/SKILL.md`)
- **Tooling:** `/release` skill for versioned releases (`.claude/skills/release/SKILL.md`)
