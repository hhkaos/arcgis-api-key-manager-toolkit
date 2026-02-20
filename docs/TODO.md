# ArcGIS API Key Explorer — Task List

**Tracks implementation progress against PLAN.md**

Legend: `[ ]` todo, `[~]` in progress, `[x]` done

---

## Phase 0 — Project Scaffolding

- [ ] Initialize root `package.json` with npm workspaces
- [ ] Create `packages/core/`, `packages/vscode/`, `packages/chrome/` directories
- [ ] Create root `tsconfig.base.json` (strict, ES2020+)
- [ ] Create per-package `tsconfig.json` files extending base
- [ ] Set up esbuild build scripts (root + per-package)
- [ ] Configure ESLint + Prettier (shared config at root)
- [ ] Create `.gitignore`
- [x] Initialize git repository

---

## Phase 1 — Shared Core (`packages/core`)

### 1.1 Data Model & Types

- [ ] Define `Environment` type (online | location-platform | enterprise)
- [ ] Define `EnvironmentConfig` interface
- [ ] Define `AuthToken` interface
- [ ] Define `ApiKeyCredential` interface
- [ ] Define `KeySlotStatus` interface
- [ ] Define `ExpirationCategory` enum (ok, warning, critical, expired)
- [ ] Define filter and sort types

### 1.2 Environment Manager

- [ ] Implement `EnvironmentManager` class
- [ ] `addEnvironment()` — register new environment with client ID
- [ ] `removeEnvironment()` — remove by ID
- [ ] `listEnvironments()` — return grouped by product type
- [ ] `setActiveEnvironment()` / `getActiveEnvironment()`
- [ ] Wire to `StorageAdapter` interface for persistence

### 1.3 ArcGIS REST Client

- [ ] Install `@esri/arcgis-rest-request` and `@esri/arcgis-rest-developer-credentials`
- [ ] Implement `fetchCredentials()` with silent multi-page pagination
- [ ] Implement `fetchCredentialDetail()` for single credential
- [ ] Implement `createApiKey()` for slot 1 or 2
- [ ] Implement `regenerateApiKey()` for slot 1 or 2
- [ ] Implement `detectCapabilities()` for Enterprise graceful degradation
- [ ] Map REST errors to human-readable error types

### 1.4 Business Logic

- [ ] Implement `categorizeExpiration()` (>30d green, 7-30d yellow, <7d red, expired gray)
- [ ] Implement `filterCredentials()` (name, tags, privileges, expiration state)
- [ ] Implement `sortCredentials()` (name, expiration, creation date)
- [ ] Implement `analyzeReferrers()` (flag wildcards, permissive patterns)
- [ ] Implement debounce utility

### 1.5 Platform Adapter Interfaces

- [ ] Define `StorageAdapter` interface
- [ ] Define `AuthAdapter` interface
- [ ] Define `ClipboardAdapter` interface

### 1.6 Shared Lit Web Components

- [ ] Install Lit dependency
- [ ] Implement `<config-gate>` — first-run environment configuration screen
- [ ] Implement `<sign-in-view>` — sign-in button with error state
- [ ] Implement `<environment-selector>` — dropdown to switch environments
- [ ] Implement `<expiration-badge>` — color-coded badge component
- [ ] Implement `<credential-list>` — searchable, filterable, sortable list
  - [ ] Search input with debounce
  - [ ] Filter dropdowns (tag, privilege, expiration)
  - [ ] Sort selector
  - [ ] Refresh button
  - [ ] Credential row rendering with badges
- [ ] Implement `<credential-detail>` — full detail view
  - [ ] Metadata section
  - [ ] Flat privilege list with icons
  - [ ] Annotated referrer list
  - [ ] Key 1 / Key 2 status cards with action buttons
- [ ] Implement `<key-action-modal>` — create/regenerate confirmation + result
  - [ ] Full context display (name, slot, partial ID, creation date)
  - [ ] Destructive warning text
  - [ ] Post-execute key display with copy button
  - [ ] "Copied!" toast (2s) with clipboard failure fallback
  - [ ] Auto-purge key value from state on modal close

### 1.7 WebView Messaging Protocol

- [ ] Define message types (host → webview, webview → host)
- [ ] Implement message serialization/deserialization helpers
- [ ] Document the protocol (inline TypeScript types are sufficient)

---

## Phase 2 — VS Code Extension (`packages/vscode`)

### 2.1 Extension Entry Point

- [ ] Create `extension.ts` with `activate()` / `deactivate()`
- [ ] Register TreeView provider
- [ ] Register all commands

### 2.2 Platform Adapters

- [ ] Implement `StorageAdapter` using `SecretStorage` (tokens) + `globalState` (config)
- [ ] Implement `AuthAdapter` using VS Code authentication API / URI handler
- [ ] Implement `ClipboardAdapter` using `vscode.env.clipboard`

### 2.3 TreeView Provider

- [ ] Implement `TreeDataProvider` for "ArcGIS API Keys" panel
- [ ] Render root nodes: ArcGIS Online, Location Platform, Enterprise
- [ ] Render child account nodes with sign-in status icons
- [ ] Context menu: Sign In, Sign Out, Remove, Refresh
- [ ] Click handler: open WebView tab for selected account

### 2.4 WebView Panel Provider

- [ ] Create `WebviewPanel` per account (editor tab style)
- [ ] Bundle and load shared Lit components into WebView
- [ ] Set up Content Security Policy
- [ ] Implement messaging bridge (WebView ↔ extension host ↔ core REST client)
- [ ] Handle panel lifecycle (dispose, visibility)

### 2.5 OAuth Flow

- [ ] Implement OAuth PKCE flow via VS Code auth API or `env.openExternal` + URI handler
- [ ] Register URI handler for callback
- [ ] Exchange auth code for access token
- [ ] Store token in SecretStorage keyed by environment ID
- [ ] Handle token expiry: block + re-auth + require user restart

### 2.6 Commands

- [ ] `arcgis-api-keys.addEnvironment` — prompt for type, client ID, portal URL
- [ ] `arcgis-api-keys.removeEnvironment` — quick pick selector
- [ ] `arcgis-api-keys.signIn`
- [ ] `arcgis-api-keys.signOut`
- [ ] `arcgis-api-keys.refresh`

### 2.7 Extension Manifest

- [ ] Configure `viewsContainers` and `views` in `package.json`
- [ ] Configure `commands` contributions
- [ ] Configure `menus` for TreeView context actions
- [ ] Set activation events (`onView:arcgisApiKeys`)

---

## Phase 3 — Chrome Extension (`packages/chrome`)

### 3.1 Manifest

- [ ] Create `manifest.json` (Manifest V3)
- [ ] Configure `permissions`: `identity`, `storage`
- [ ] Configure `host_permissions` for ArcGIS endpoints
- [ ] Configure `action` (popup), `background` (service worker)

### 3.2 Platform Adapters

- [ ] Implement `StorageAdapter` using `chrome.storage.session`
- [ ] Implement `AuthAdapter` using `chrome.identity.launchWebAuthFlow`
- [ ] Implement `ClipboardAdapter` using `navigator.clipboard` with fallback

### 3.3 Popup (Launcher)

- [ ] Create `popup.html` — minimal launcher page
- [ ] Environment selector dropdown
- [ ] Sign-in status display
- [ ] "Open Explorer" button → `chrome.tabs.create()`

### 3.4 Full-Tab Page

- [ ] Create `explorer.html` with shared Lit components
- [ ] Set up messaging bridge (tab page ↔ service worker)
- [ ] Environment selector in-page
- [ ] Load credential list, detail, and modal components

### 3.5 Service Worker

- [ ] Create background service worker
- [ ] Handle messages from popup and full-tab page
- [ ] Execute core REST client calls
- [ ] Manage OAuth flow via `chrome.identity`
- [ ] Manage tokens in `chrome.storage.session`

### 3.6 Enterprise Host Permissions

- [ ] Implement dynamic host permission requests via `chrome.permissions.request()`
- [ ] Request on Enterprise environment configuration
- [ ] Persist granted permissions

---

## Phase 4 — Testing & Validation

### 4.1 Unit Tests

- [ ] Test expiration categorization logic
- [ ] Test credential filtering (name, tag, privilege, expiration)
- [ ] Test credential sorting
- [ ] Test referrer analysis (wildcard detection, annotations)
- [ ] Test environment manager (add, remove, switch)
- [ ] Test REST client pagination handling (mocked)
- [ ] Test REST client error mapping (mocked)

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
- [ ] Document OAuth setup instructions (README)
- [ ] Security review of SecretStorage usage

### 5.2 Chrome Extension

- [ ] Package for Chrome Web Store
- [ ] Write permission justification
- [ ] Document OAuth setup and redirect URI configuration
- [ ] Security review of manifest permissions

---
