# ArcGIS API Key Explorer — Implementation Plan

**v1.2 — Aligned with SPEC.md v1.2**

---

## Overview

The implementation follows the spec's build order: **shared core first, then VS Code extension, then Chrome extension**. Each phase builds on the previous one. The shared core and VS Code extension are developed together since VS Code is the primary validation target.

---

## Phase 0 — Project Scaffolding

Set up the monorepo structure, tooling, and CI foundations before writing any application code.

### 0.1 Monorepo Initialization

- Initialize the root project with `package.json` (private, workspaces enabled)
- Choose a workspace manager: **npm workspaces** (simplest, no extra tooling)
- Create the three package directories:
  - `packages/core/`
  - `packages/vscode/`
  - `packages/chrome/`
- Each package gets its own `package.json` and `tsconfig.json`

### 0.2 TypeScript Configuration

- Root `tsconfig.base.json` with shared compiler options (strict mode, ES2020+ target)
- Per-package `tsconfig.json` extending the base
- `packages/core`: target ES2020, module ESNext (consumed by both platforms)
- `packages/vscode`: target ES2020, module CommonJS (VS Code requirement)
- `packages/chrome`: target ES2020, module ESNext

### 0.3 Build Tooling

- **esbuild** for fast bundling across all packages
- `packages/core`: build as ESM library, also bundle Lit components
- `packages/vscode`: bundle extension entry point (CommonJS for VS Code)
- `packages/chrome`: bundle popup, full-tab page, and service worker
- Root-level `build` script that builds core → vscode → chrome in order

### 0.4 Linting & Formatting

- ESLint with TypeScript plugin
- Prettier for formatting
- Shared config at root level

### 0.5 Git & CI

- `.gitignore` for node_modules, dist, .env, *.vsix, etc.
- Initial `README.md` with project overview

---

## Phase 1 — Shared Core (`packages/core`)

The shared core contains everything both extensions need: types, REST client, business logic, and Lit UI components.

### 1.1 Data Model & Types

Define TypeScript interfaces for the full data model:

- `Environment` — type (online | location-platform | enterprise), portalUrl, clientId
- `EnvironmentConfig` — persisted configuration for all environments
- `AuthToken` — access token, expiry timestamp, environment reference
- `ApiKeyCredential` — id, name, tags, created, expiration, referrers, privileges, key1Status, key2Status
- `KeySlotStatus` — exists, partialIdentifier, creationDate
- `ExpirationCategory` — enum: ok, warning, critical, expired (maps to green/yellow/red/gray)

### 1.2 Environment Manager

Manages multi-environment configuration and active environment state:

- `addEnvironment(config)` — register a new environment
- `removeEnvironment(id)` — remove an environment
- `listEnvironments()` — returns all configured environments grouped by product type
- `getActiveEnvironment()` — returns the currently selected environment
- `setActiveEnvironment(id)` — switch active environment

Depends on a **platform storage adapter** interface (implemented differently in VS Code and Chrome).

### 1.3 ArcGIS REST Client

Thin wrapper around `@esri/arcgis-rest-js` exposing only the operations we need:

- **Dependencies**: `@esri/arcgis-rest-request`, `@esri/arcgis-rest-developer-credentials`
- `fetchCredentials(auth, portalUrl)` — fetch all API key credentials for the authenticated user, handling pagination silently
- `fetchCredentialDetail(auth, portalUrl, itemId)` — fetch full detail for a single credential
- `createApiKey(auth, portalUrl, itemId, slot, expiration?)` — create a key in slot 1 or 2
- `regenerateApiKey(auth, portalUrl, itemId, slot, expiration?)` — regenerate an existing key
- `detectCapabilities(auth, portalUrl)` — probe which features the portal supports (for Enterprise graceful degradation)

The client uses `ArcGISIdentityManager` from arcgis-rest-js for token management. The OAuth flow itself is platform-specific and injected.

### 1.4 Business Logic

Pure functions with no platform dependencies:

- **Expiration categorization**: `categorizeExpiration(date) → ExpirationCategory` using hardcoded thresholds (>30d green, 7-30d yellow, <7d red, past=expired)
- **Filtering**: `filterCredentials(credentials, filters)` — by name search, tags, privileges, expiration state
- **Sorting**: `sortCredentials(credentials, sortKey, direction)` — by name, expiration, creation date
- **Referrer analysis**: `analyzeReferrers(patterns)` — annotate wildcard-only, overly permissive entries
- **Debounce utility**: generic debounce for search input

### 1.5 Platform Adapter Interfaces

Abstract interfaces that each platform implements:

```typescript
interface StorageAdapter {
  getToken(environmentId: string): Promise<string | null>;
  setToken(environmentId: string, token: string): Promise<void>;
  clearToken(environmentId: string): Promise<void>;
  getEnvironments(): Promise<EnvironmentConfig>;
  setEnvironments(config: EnvironmentConfig): Promise<void>;
}

interface AuthAdapter {
  startOAuthFlow(environment: Environment): Promise<AuthToken>;
  logout(environmentId: string): Promise<void>;
}

interface ClipboardAdapter {
  copy(text: string): Promise<{ success: boolean }>;
}
```

### 1.6 Shared Lit Web Components

UI components used by both Chrome full-tab and VS Code WebView:

- **`<credential-list>`** — searchable, filterable, sortable list of credentials
  - Search input (debounced)
  - Filter dropdowns (tag, privilege, expiration state)
  - Sort selector
  - Refresh button
  - Credential rows with expiration badges
- **`<credential-detail>`** — full detail view for a single credential
  - Metadata section
  - Privilege flat list with icons
  - Annotated referrer list
  - Key 1 / Key 2 status cards with action buttons
- **`<key-action-modal>`** — confirmation + result modal for create/regenerate
  - Full context display (name, slot, partial ID, creation date)
  - Destructive warning text
  - Execute / Cancel buttons
  - Post-execution: key display with copy button and "Copied!" toast
  - Auto-purge key from state on close
- **`<expiration-badge>`** — color-coded badge (green/yellow/red/gray)
- **`<environment-selector>`** — dropdown to switch active environment
- **`<config-gate>`** — first-run configuration screen
- **`<sign-in-view>`** — "Sign in with ArcGIS" button with error state

All components communicate via events and properties — no global state. The host application (VS Code WebView or Chrome tab) provides the data and handles events.

### 1.7 WebView Messaging Protocol

Define a message protocol for communication between the extension host and the WebView:

- **Host → WebView**: `setCredentials`, `setCredentialDetail`, `setEnvironments`, `setAuthState`, `setError`
- **WebView → Host**: `requestCredentials`, `requestDetail`, `signIn`, `signOut`, `createKey`, `regenerateKey`, `switchEnvironment`, `copyToClipboard`, `refresh`

This protocol is the same for both VS Code (`postMessage` / `onDidReceiveMessage`) and Chrome (messaging between service worker and tab page).

---

## Phase 2 — VS Code Extension (`packages/vscode`)

### 2.1 Extension Entry Point

- `extension.ts` with `activate()` and `deactivate()`
- Register the TreeView provider
- Register commands: add environment, remove environment, sign in, sign out, refresh, open credential explorer

### 2.2 Platform Adapters (VS Code)

Implement the core adapter interfaces:

- **StorageAdapter**: `SecretStorage` for tokens, `globalState` for environment config
- **AuthAdapter**: VS Code authentication API for OAuth PKCE flow. Redirect URI is registered per user's ArcGIS Application.
- **ClipboardAdapter**: `vscode.env.clipboard.writeText()`

### 2.3 TreeView Provider

Implement `TreeDataProvider` for the sidebar:

- **Root nodes** (static): "ArcGIS Online", "ArcGIS Location Platform", "ArcGIS Enterprise"
- **Child nodes** (dynamic): configured accounts under each product
- Each account node shows sign-in status (icon)
- Context menu items: Sign In, Sign Out, Remove, Refresh
- `getTreeItem()` returns items with `command` that opens the WebView tab on click

### 2.4 WebView Panel Provider

When an account is clicked in the TreeView:

- Create or reveal a `WebviewPanel` for that account
- Load the shared Lit components into the WebView
- Set up the messaging bridge: translate WebView messages → core REST client calls → send results back
- Handle lifecycle (panel dispose, visibility changes)
- Content Security Policy: restrict scripts to bundled assets, restrict connections to ArcGIS endpoints

### 2.5 OAuth Flow

- Implement using VS Code's `authentication` API or `vscode.env.openExternal` + URI handler
- Register a URI handler for the OAuth callback
- Exchange authorization code for access token using PKCE
- Store token in SecretStorage keyed by environment ID

### 2.6 Command Palette Integration

Register commands:

- `arcgis-api-keys.addEnvironment` — prompt for type, client ID, portal URL
- `arcgis-api-keys.removeEnvironment` — quick pick to select which environment to remove
- `arcgis-api-keys.signIn` — sign in to the active/selected environment
- `arcgis-api-keys.signOut` — sign out
- `arcgis-api-keys.refresh` — refresh credentials for active environment

### 2.7 Extension Manifest

`package.json` contributions:

- `viewsContainers` and `views` for the TreeView sidebar
- `commands` for all registered commands
- `menus` for TreeView context actions
- `configuration` for any extension settings
- Activation events: `onView:arcgisApiKeys`

---

## Phase 3 — Chrome Extension (`packages/chrome`)

### 3.1 Manifest V3

`manifest.json`:

- `permissions`: `identity`, `storage` (session only)
- `host_permissions`: ArcGIS endpoints only (`https://*.arcgis.com/*`, user-configured Enterprise URLs)
- `action`: popup page
- `background`: service worker
- No content scripts

### 3.2 Platform Adapters (Chrome)

Implement the core adapter interfaces:

- **StorageAdapter**: `chrome.storage.session` for tokens and environment config
- **AuthAdapter**: `chrome.identity.launchWebAuthFlow` for OAuth PKCE. Redirect URL is `https://<extension-id>.chromiumapp.org/`
- **ClipboardAdapter**: `navigator.clipboard.writeText()` with fallback

### 3.3 Popup (Launcher)

Minimal HTML page:

- Environment selector dropdown (populated from storage)
- Sign-in status for the active environment
- "Open Explorer" button → `chrome.tabs.create()` with the full-tab page URL

### 3.4 Full-Tab Page

`explorer.html` loaded via `chrome.tabs.create({ url: chrome.runtime.getURL("explorer.html") })`:

- Loads the same shared Lit components as VS Code
- Messaging bridge: uses `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` to communicate with the service worker
- Service worker handles all REST API calls and auth

### 3.5 Service Worker

Background service worker:

- Listens for messages from popup and full-tab page
- Executes REST client operations (fetch credentials, create/regenerate keys)
- Manages OAuth flow via `chrome.identity`
- Manages token lifecycle in `chrome.storage.session`

### 3.6 Enterprise Host Permissions

For ArcGIS Enterprise environments, the user provides a custom portal URL. This requires dynamic host permissions:

- Use `chrome.permissions.request()` to add the Enterprise portal URL at runtime
- Only request when the user configures an Enterprise environment
- Store granted permissions so re-requests aren't needed

---

## Phase 4 — Testing & Validation

### 4.1 Unit Tests

- Core business logic: expiration categorization, filtering, sorting, referrer analysis
- Core REST client: mock `@esri/arcgis-rest-js` calls, verify pagination handling and error mapping
- Environment manager: add/remove/switch logic

### 4.2 Integration Testing

- VS Code extension: test TreeView rendering, WebView panel lifecycle, command execution
- Chrome extension: test popup ↔ service worker messaging, full-tab page rendering

### 4.3 Manual E2E Testing

- Against real ArcGIS dev account (as decided in interview)
- Test all three environment types: Online, Location Platform, Enterprise
- Test key creation and regeneration flow end-to-end
- Test token expiry scenarios
- Test Enterprise graceful degradation

---

## Phase 5 — Polish & Release Prep

### 5.1 VS Code Extension

- Package as `.vsix`
- Write Marketplace listing description
- Document OAuth setup instructions (user must register ArcGIS Application)
- Security review of SecretStorage usage

### 5.2 Chrome Extension

- Package for Chrome Web Store
- Write permission justification
- Document OAuth setup and redirect URI configuration
- Security review of manifest permissions

---

## Dependency Map

```text
Phase 0: Scaffolding
   │
   ▼
Phase 1: packages/core
   │
   ├──────────────────┐
   ▼                  ▼
Phase 2: vscode    Phase 3: chrome
   │                  │
   ▼                  ▼
Phase 4: Testing (both)
   │
   ▼
Phase 5: Release Prep
```

Phase 2 and Phase 3 can run in parallel once Phase 1 is complete, but per the spec, VS Code is prioritized first.

---

## Key Technical Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| VS Code authentication API may not support ArcGIS OAuth well | Fall back to `vscode.env.openExternal` + URI handler approach |
| `@esri/arcgis-rest-developer-credentials` may have browser compatibility issues | Test early; fall back to raw `request()` calls if needed |
| Lit components may need different CSP settings per platform | Define CSP early and test in both WebView and Chrome tab contexts |
| ArcGIS Enterprise API differences are unknown until tested | Build capability detection early in Phase 1; test against Enterprise in Phase 4 |
| `chrome.storage.session` has size limits (10MB total) | Token + config data is small; not a real concern, but validate |
