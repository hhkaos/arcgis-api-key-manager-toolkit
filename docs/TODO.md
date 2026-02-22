# ArcGIS API Key Explorer — Task List

**Tracks implementation progress against PLAN.md**

Legend: `[ ]` todo, `[~]` in progress, `[x]` done

---

## Done

- [x] Add "Open API Key settings in ArcGIS ↗" link in `<credential-detail>` header; fix `fetchPortalBase()` to use `urlKey`+`customBaseUrl`; fix expiration milliseconds to `:00`; theme-fix `<key-action-modal>` colors with VS Code tokens; add `webview/open-external-url` protocol message with VS Code handler and Chrome propagation - 2026-02-22
- [x] Fix slot card partial ID display: always derive from registered app `client_id` as `AT{slot}_{last 8 chars}`; remove unavailable "Created" row - 2026-02-22
- [x] Add per-slot expiration dates (`expiration` field on `KeySlotStatus`) and per-slot badges (K1/K2) in credential list; add `fetchPortalBase()` and settings deep-links (↗) in list rows; update icon; fix "Doesn't expires" typo - 2026-02-21
- [x] Fix Online credential retrieval to merge new API token credentials and legacy API key items, then hydrate list/detail metadata (expiration, privileges, key-slot status, tags/referrers) from item + registered app endpoints - 2026-02-20
- [x] Fix Chrome manifest invalid permission declaration (`permissions` entry) to remove extension warning/error - 2026-02-20
- [x] Align Online/Location Platform key create/regenerate logic with ArcGIS REST JS `updateApiKey` slot-generation behavior, with endpoint fallback compatibility - 2026-02-20
- [x] Implement end-to-end shared core + VS Code credential explorer baseline from current repository diff - 2026-02-20
- [x] Modernize UI to compact, squared, Material-inspired styling across shared Lit components and VS Code webview shell (unplanned) - 2026-02-20
- [x] Add dynamic VS Code theme-token adoption (`--vscode-*`) so UI matches active editor theme/profile with safe fallbacks (unplanned) - 2026-02-20
- [x] Re-sequence implementation to build Chrome extension baseline before remaining VS Code polish tasks for faster UI debugging (planned deviation) - 2026-02-20
- [x] Add Chrome popup state unit tests for auth control visibility, enterprise portal field visibility, and post-sign-in explorer auto-open logic - 2026-02-20

---

## Phase 0 — Project Scaffolding

- [x] Initialize root `package.json` with npm workspaces
- [x] Create `packages/core/`, `packages/vscode/`, `packages/chrome/` directories
- [x] Create root `tsconfig.base.json` (strict, ES2020+)
- [x] Create per-package `tsconfig.json` files extending base
- [x] Set up esbuild build scripts (root + per-package)
- [x] Configure ESLint + Prettier (shared config at root)
- [x] Create `.gitignore`
- [x] Initialize git repository

---

## Phase 1 — Shared Core (`packages/core`)

### 1.1 Data Model & Types

- [x] Define `Environment` type (online | location-platform | enterprise)
- [x] Define `EnvironmentConfig` interface
- [x] Define `AuthToken` interface
- [x] Define `ApiKeyCredential` interface
- [x] Define `KeySlotStatus` interface
- [x] Define `ExpirationCategory` enum (ok, warning, critical, expired)
- [x] Define filter and sort types

### 1.2 Environment Manager

- [x] Implement `EnvironmentManager` class
- [x] `addEnvironment()` — register new environment with client ID
- [x] `removeEnvironment()` — remove by ID
- [x] `listEnvironments()` — return grouped by product type
- [x] `setActiveEnvironment()` / `getActiveEnvironment()`
- [x] Wire to `StorageAdapter` interface for persistence

### 1.3 ArcGIS REST Client

- [x] Install `@esri/arcgis-rest-request` and `@esri/arcgis-rest-developer-credentials`
- [x] Implement `fetchCredentials()` with silent multi-page pagination
- [x] Implement `fetchCredentialDetail()` for single credential
- [x] Implement `createApiKey()` for slot 1 or 2
- [x] Implement `regenerateApiKey()` for slot 1 or 2
- [x] Implement `revokeApiKey()` for slot 1 or 2
- [x] Implement `detectCapabilities()` for Enterprise graceful degradation
- [x] Map REST errors to human-readable error types

### 1.4 Business Logic

- [x] Implement `categorizeExpiration()` (>30d green, 7-30d yellow, <7d red, expired gray)
- [x] Implement `filterCredentials()` (name, tags, privileges, expiration state)
- [x] Implement `sortCredentials()` (name, expiration, creation date)
- [x] Implement `analyzeReferrers()` (flag wildcards, permissive patterns)
- [x] Implement debounce utility

### 1.5 Platform Adapter Interfaces

- [x] Define `StorageAdapter` interface
- [x] Define `AuthAdapter` interface
- [x] Define `ClipboardAdapter` interface

### 1.6 Shared Lit Web Components

- [x] Install Lit dependency
- [x] Implement `<config-gate>` — first-run environment configuration screen
- [x] Implement `<sign-in-view>` — sign-in button with error state
- [x] Implement `<environment-selector>` — dropdown to switch environments
- [x] Implement `<expiration-badge>` — color-coded badge component
- [x] Implement `<credential-list>` — searchable, filterable, sortable list
  - [x] Search input with debounce
  - [x] Filter dropdowns (tag, privilege, expiration)
  - [x] Sort selector
  - [x] Refresh button
  - [x] Credential row rendering with badges
- [x] Implement `<credential-detail>` — full detail view
  - [x] Metadata section
  - [x] Flat privilege list with icons
  - [x] Annotated referrer list
  - [x] Key 1 / Key 2 status cards with action buttons
- [x] Implement `<key-action-modal>` — create/regenerate confirmation + result
  - [x] Full context display (name, slot, partial ID, creation date)
  - [x] Destructive warning text
  - [x] Post-execute key display with copy button
  - [x] "Copied!" toast (2s) with clipboard failure fallback
  - [x] Auto-purge key value from state on modal close

### 1.7 WebView Messaging Protocol

- [x] Define message types (host → webview, webview → host)
- [x] Implement message serialization/deserialization helpers
- [x] Document the protocol (inline TypeScript types are sufficient)

---

## Phase 2 — VS Code Extension (`packages/vscode`)

### 2.1 Extension Entry Point

- [x] Create `extension.ts` with `activate()` / `deactivate()`
- [x] Register TreeView provider
- [x] Register all commands

### 2.2 Platform Adapters

- [x] Implement `StorageAdapter` using `SecretStorage` (tokens) + `globalState` (config)
- [x] Implement `AuthAdapter` using VS Code authentication API / URI handler
- [x] Implement `ClipboardAdapter` using `vscode.env.clipboard`

### 2.3 TreeView Provider

- [x] Implement `TreeDataProvider` for "ArcGIS API Keys" panel
- [x] Render root nodes: ArcGIS Online, Location Platform, Enterprise
- [x] Render child account nodes with sign-in status icons
- [x] Context menu: Sign In, Sign Out, Remove, Refresh
- [x] Click handler: open WebView tab for selected account

### 2.4 WebView Panel Provider

- [x] Create `WebviewPanel` per account (editor tab style)
- [x] Bundle and load shared Lit components into WebView
- [x] Set up Content Security Policy
- [x] Implement messaging bridge (WebView ↔ extension host ↔ core REST client)
- [x] Handle panel lifecycle (dispose, visibility)

### 2.5 OAuth Flow

- [x] Implement OAuth PKCE flow via VS Code auth API or `env.openExternal` + URI handler
- [x] Register URI handler for callback
- [x] Exchange auth code for access token
- [x] Store token in SecretStorage keyed by environment ID
- [x] Handle token expiry: SESSION_EXPIRED silently transitions to logged-out state in the webview (credential list hidden, sign-in button shown)

### 2.6 Commands

- [x] `arcgis-api-keys.addEnvironment` — prompt for type, client ID, portal URL
- [x] `arcgis-api-keys.removeEnvironment` — quick pick selector
- [x] `arcgis-api-keys.signIn`
- [x] `arcgis-api-keys.signOut`
- [x] `arcgis-api-keys.refresh`

### 2.7 Extension Manifest

- [x] Configure `viewsContainers` and `views` in `package.json`
- [x] Configure `commands` contributions
- [x] Configure `menus` for TreeView context actions
- [x] Set activation events (`onView:arcgisApiKeys`)

---

## Phase 3 — Chrome Extension (`packages/chrome`)

Status: `[x] Baseline implemented` (moved ahead of remaining VS Code polish on 2026-02-20)

### 3.1 Manifest

- [x] Create `manifest.json` (Manifest V3)
- [x] Configure `permissions`: `identity`, `storage`
- [x] Configure `host_permissions` for ArcGIS endpoints
- [x] Configure `action` (popup), `background` (service worker)

### 3.2 Platform Adapters

- [x] Implement `StorageAdapter` using `chrome.storage.session`
- [x] Implement `AuthAdapter` using `chrome.identity.launchWebAuthFlow`
- [x] Implement `ClipboardAdapter` using `navigator.clipboard` with fallback

### 3.3 Popup (Launcher)

- [x] Create `popup.html` — minimal launcher page
- [x] Environment selector dropdown
- [x] Sign-in status display
- [x] "Open Explorer" button → `chrome.tabs.create()`

### 3.4 Full-Tab Page

- [x] Create `explorer.html` with shared Lit components
- [x] Set up messaging bridge (tab page ↔ service worker)
- [x] Environment selector in-page
- [x] Load credential list, detail, and modal components

### 3.5 Service Worker

- [x] Create background service worker
- [x] Handle messages from popup and full-tab page
- [x] Execute core REST client calls
- [x] Manage OAuth flow via `chrome.identity`
- [x] Manage tokens in `chrome.storage.session`

### 3.6 Enterprise Host Permissions

- [x] Implement dynamic host permission requests via `chrome.permissions.request()`
- [x] Request on Enterprise environment configuration
- [x] Persist granted permissions

---

## Phase 4 — Testing & Validation

### 4.1 Unit Tests

- [x] Test expiration categorization logic
- [x] Test credential filtering (name, tag, privilege, expiration)
- [x] Test credential sorting
- [x] Test referrer analysis (wildcard detection, annotations)
- [x] Test environment manager (add, remove, switch)
- [x] Test REST client pagination handling (mocked)
- [x] Test REST client error mapping (mocked)
- [x] Test Chrome popup visibility and sign-in post-auth state rules

### 4.2 Manual E2E Testing

- [ ] Test OAuth sign-in / sign-out (VS Code)
- [ ] Test OAuth sign-in / sign-out (Chrome)
- [ ] Test credential list loading with real ArcGIS account
- [ ] Test credential detail view
- [ ] Test key creation (both slots)
- [ ] Test key regeneration (both slots)
- [ ] Test copy-to-clipboard flow (success + failure fallback)
- [ ] Test token expiry during operation (block + re-auth + restart)
- [ ] Test multi-environment switching
- [ ] Test ArcGIS Enterprise environment (if available)
- [ ] Test Enterprise graceful degradation (unsupported features)

---

## Phase 5 — Polish & Release Prep

### 5.1 VS Code Extension

- [ ] Package as `.vsix`
- [ ] Write Marketplace listing description
- [x] Document OAuth setup instructions (README)
- [ ] Security review of SecretStorage usage

### 5.2 Chrome Extension

- [ ] Package for Chrome Web Store
- [ ] Write permission justification
- [ ] Document OAuth setup and redirect URI configuration
- [ ] Security review of manifest permissions

---
