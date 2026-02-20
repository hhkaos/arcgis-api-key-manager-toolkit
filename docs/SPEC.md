# ArcGIS API Key Explorer

## Chrome Extension & VS Code Extension

**Functional & Technical Specification (v1.2)**

---

## Part A — Common Specification

This section covers shared architecture, data model, business logic, and requirements that apply to both the Chrome Extension and the VS Code Extension.

---

## A.1 Purpose

Provide a secure developer tool that allows an authenticated ArcGIS user to:

- Sign in via OAuth 2.0 (Authorization Code + PKCE)
- List their own API Key Credentials
- Explore metadata (name, tags, expiration, privileges, referrer restrictions)
- See whether API Key 1 and/or API Key 2 exist
- Create or regenerate API Key 1 or API Key 2
- Copy newly generated keys (shown once only)

Scope is strictly limited to **the authenticated user's own credentials**.

---

## A.2 Non-Goals

- Organization-wide management
- Admin tooling
- Bulk operations
- Secret persistence
- Automatic background rotation
- Privilege editing (read-only view in v1)
- Telemetry or analytics collection

---

## A.3 Multi-Environment Support

The tool supports three ArcGIS product environments:

- **ArcGIS Online** — cloud-hosted at `arcgis.com`
- **ArcGIS Location Platform** — developer-focused platform
- **ArcGIS Enterprise** — self-hosted portal (user-provided URL)

### Environment Configuration

- Each environment requires a separate **user-registered ArcGIS Application** (client ID)
- Users configure their own client IDs — no shared/bundled client ID ships with the extension
- For ArcGIS Enterprise, the user must also provide the portal base URL
- Multiple environments can be configured simultaneously

### Environment Switching

- Only one environment is active at a time in the credential explorer
- OAuth tokens are **cached per environment** — switching does not require re-authentication
- Switching environments changes the active REST API base URL and OAuth endpoint

---

## A.4 Architecture

### Monorepo Structure

The project is organized as a monorepo with a shared core package:

```text
packages/
  core/          — Shared business logic, REST client, data model
  chrome/        — Chrome extension shell
  vscode/        — VS Code extension shell
```

### Shared Core (`packages/core`)

- ArcGIS REST client layer (using `@esri/arcgis-rest-js`)
- Data model and types
- Business logic (filtering, sorting, expiration categorization)
- Environment/connection management
- Platform-agnostic interfaces for storage and auth

### Shared WebView UI

Both Chrome (full-tab page) and VS Code (WebView panel) render the same credential management UI. This shared UI is built with:

- **TypeScript**
- **Lit (Web Components)** — lightweight, web-standards-based, compatible with both Chrome tabs and VS Code WebViews

### Client-Only Architecture

- No backend server or broker
- No DOM scraping
- No unofficial endpoints
- Use official ArcGIS REST endpoints only

---

## A.5 Authentication Model

### Protocol

- OAuth 2.0 Authorization Code Flow
- PKCE (mandatory)
- No client secret
- User brings their own ArcGIS Application (client ID)
- Token scoped to authenticated user

### Token Caching

- One token stored per configured environment
- Tokens persisted in platform-appropriate secure storage
- Switching environments uses the cached token (no re-auth required)
- Explicit logout clears the token for the active environment

### Token Expiry During Operations

- If a token expires mid-session (e.g., during a key regeneration attempt):
  1. Block the operation
  2. Show "Session expired" message
  3. Require re-authentication
  4. User must **re-initiate** the operation manually (no auto-resume)
- Destructive actions are never auto-resumed after re-auth

---

## A.6 Data Model

Each **API Key Credential** exposes:

- `id`
- `name`
- `tags`
- `created` date
- `expiration` date
- `referrer` restrictions (list of URL patterns)
- `privileges` — full flat list of all granted privileges (basemaps, geocoding, routing, elevation, places, etc.)
- API Key 1 status:
  - exists (boolean)
  - partial identifier (if available)
  - creation date (if available)
- API Key 2 status:
  - exists (boolean)
  - partial identifier (if available)
  - creation date (if available)

**Important:** Existing API key values are not retrievable. Keys are only visible immediately after creation/regeneration.

---

## A.7 Functional Requirements

### A.7.1 Configuration Gate

Before sign-in is available, the user must configure at least one environment:

- Provide an ArcGIS Application **client ID**
- Select the environment type (Online, Location Platform, or Enterprise)
- For Enterprise: provide the portal base URL

No "Sign In" button is shown until configuration is complete.

### A.7.2 Authentication Flow

If not authenticated in the active environment:

- Show "Sign in with ArcGIS"
- Launch OAuth flow
- On success → display credentials list
- On failure → display human-readable error state

### A.7.3 Credentials List View

Display searchable list of user-owned API Key Credentials for the active environment.

Each item shows:

- Name
- Tags
- Expiration date with **color-coded badge**:
  - Green: >30 days remaining
  - Yellow: 7–30 days remaining
  - Red: <7 days remaining
  - Gray/strikethrough: expired
  - (Thresholds are hardcoded in v1)
- Enabled privileges (visual indicators)
- API Key 1 status
- API Key 2 status

#### Data Loading

- Full-fetch all credentials on initial load (silent multi-page fetch if paginated)
- All filtering and sorting performed client-side in-memory
- Manual **refresh button** to re-fetch data

#### Filters

- Search by name
- Filter by tag
- Filter by privilege
- Filter by expiration state

#### Sorting

- Name
- Expiration date
- Creation date

### A.7.4 Credential Detail View

Display:

- Full metadata
- **Full flat privilege list** — every granted privilege shown with icons/badges (no grouping or collapsing)
- **Annotated referrer restrictions** — display URL patterns with visual annotations:
  - Warn on wildcard-only patterns (e.g., `*`)
  - Highlight unusual or overly permissive entries
- Expiration configuration with color-coded badge
- API Key 1 status
- API Key 2 status

### A.7.5 Key Action Logic

#### API Key 1

- If not exists → **Create API Key 1**
- If exists → **Regenerate API Key 1**

#### API Key 2

- If not exists → **Create API Key 2**
- If exists → **Regenerate API Key 2**

The tool is **agnostic about the user's rotation strategy** — it does not prescribe or guide a specific rotation workflow.

### A.7.6 Create / Regenerate Flow

1. **Confirmation modal** showing full context:
   - Credential name
   - Key slot (1 or 2)
   - Partial identifier of the existing key being replaced (if available)
   - Creation date of the existing key (if available)
   - Warning: "Regeneration permanently invalidates the previous key"
2. Optional expiration configuration (if supported)
3. Execute operation
4. **Display new key:**
   - Visible once
   - Copy button with **visual confirmation** ("Copied!" toast for 2 seconds)
   - On clipboard failure: auto-select the key text as fallback, show subtle error
   - Clear warning: "This key will not be shown again."

After modal closes:

- Key value is purged from memory (set variables to `null`, clear DOM text content, remove from reactive state)
- No automatic clipboard copying

---

## A.8 UX Requirements

- Minimal, developer-oriented
- Clear separation between credential configuration and secret value
- Explicit destructive action warnings (agnostic — warn, don't prescribe)
- No misleading terminology
- In VS Code WebView, UI should inherit host theme tokens (`--vscode-*`) so light/dark/high-contrast themes are matched automatically
- Shared UI should provide safe fallback design tokens when host theme variables are unavailable (for non-VS Code hosts)

---

## A.9 Security Requirements

### Storage

- No secret persistence beyond platform-appropriate secure storage for OAuth tokens
- No sync/cloud storage
- No analytics

### Clipboard

- Explicit user action required
- No silent copy
- Visual confirmation on copy success
- Graceful fallback on clipboard failure

### Memory

- Generated key values: null references + clear DOM on modal close (standard best-effort)
- No aggressive overwrite attempts (JS string immutability makes this unreliable)

### Logging

Never log:

- Access tokens
- API keys
- Full credential responses

### Diagnostics

- No telemetry or error reporting infrastructure
- Bug reports via GitHub Issues only

---

## A.10 Error Handling

Must handle:

- Expired token (block + re-auth + restart flow)
- Revoked token
- Network failures
- Permission errors
- Invalid rotation attempts
- ArcGIS Enterprise feature gaps (graceful degradation — see A.10.1)

Errors must be human-readable.

### A.10.1 Enterprise Feature Gaps

ArcGIS Enterprise may not support all features available on ArcGIS Online (especially newer API key credential management features).

- Detect capabilities at runtime
- Disable or hide unsupported features (e.g., gray out buttons)
- Show tooltips explaining why a feature is unavailable
- Never fail silently — always inform the user

---

## A.11 Performance Requirements

- Lazy-load credential details
- Full-fetch credentials list with silent pagination
- In-memory caching (session only, per environment)
- Debounced filtering (client-side)
- Avoid redundant API calls

---

## A.12 Implementation References

The extension design aligns with the following ArcGIS REST JS scripts:

### Expiration Reference

https://raw.githubusercontent.com/EsriDevEvents/2025-DTS-ArcGIS-REST-JS-scripting-and-automating/refs/heads/main/Demos/api-keys-by-expiration/index.ts

Used for:

- Expiration extraction
- Expiration categorization
- Sorting and filtering logic

### Rotation Reference

https://raw.githubusercontent.com/EsriDevEvents/2025-DTS-ArcGIS-REST-JS-scripting-and-automating/refs/heads/main/Demos/api-key-rotation/index.ts

Used for:

- Key regeneration mechanics
- Safe rotation workflow
- Handling of returned key value

Node-specific constructs must be adapted to browser/VS Code environments.

---

## A.13 Architectural Decisions

- Client-only architecture (no backend broker)
- OAuth + PKCE with user-provided client IDs
- Monorepo with shared core package
- Lit (Web Components) for shared WebView UI
- `@esri/arcgis-rest-js` for REST API calls
- TypeScript throughout
- Multi-environment support (Online, Location Platform, Enterprise)
- Token cached per environment
- Full-fetch + client-side filtering
- Hardcoded expiration thresholds in v1

---

## A.14 Risk Analysis

### Key Risks

1. Accidental production key rotation
2. User misunderstanding of regeneration
3. Token exposure in compromised environment
4. Over-permissioned extension
5. ArcGIS Enterprise API incompatibilities

### Mitigations

- Full-context confirmation dialogs (credential name, key slot, partial ID)
- Clear destructive warnings (agnostic, not prescriptive)
- Minimal permissions
- Strict in-memory secret handling
- Runtime capability detection for Enterprise

---

## A.15 Compliance & Privacy

- No telemetry
- No analytics
- No external data collection
- Local-only execution
- Transparent permission disclosure

---

## A.16 Future Enhancements

- Privilege editing
- Scheduled rotation reminders
- Configurable expiration thresholds
- Export metadata (no secrets)
- CLI companion tool
- Optional backend broker mode
- Multi-profile support
- Guided rotation workflow mode
- Support for additional developer credential types beyond API keys

---

## A.17 Resolved Questions

The following open questions from v1.1 have been resolved:

- **Configurable expiration thresholds?** — Hardcoded in v1 (green >30d, yellow 7–30d, red <7d). Revisit later.
- **Typing confirmation for destructive actions?** — No. Standard confirmation modal with full context is sufficient.
- **Dry-run preview for rotation?** — No. Out of scope for v1.
- **Support multiple ArcGIS environments?** — Yes. Online, Location Platform, and Enterprise. One active at a time, tokens cached per environment.

---

## Part B — VS Code Extension Specification

This section covers requirements, architecture, and UX specific to the VS Code extension.

---

## B.1 Development Priority

The VS Code extension is the **primary development target**. The shared core is built alongside it, and the Chrome extension follows.

Build order:

1. `packages/core` — shared business logic
2. `packages/vscode` — VS Code extension
3. `packages/chrome` — Chrome extension (wraps shared core)

---

## B.2 Architecture

### Components

- **TreeView** — navigation sidebar for environments and accounts
- **WebView tabs** — credential management UI (shared Lit components)
- **OAuth handler** — VS Code authentication API
- **SecretStorage** — secure token persistence

No external backend required.

---

## B.3 UX: TreeView Navigation

The VS Code sidebar displays an **"ArcGIS API Keys"** panel with a hierarchical tree:

```text
ArcGIS API Keys
├── ArcGIS Online
│   ├── dev-account@esri.com
│   └── prod-account@esri.com
├── ArcGIS Location Platform
│   └── my-alp-account@esri.com
└── ArcGIS Enterprise
    └── admin@portal.company.com (https://gis.company.com/portal)
```

- Top-level nodes: product categories (Online, Location Platform, Enterprise)
- Child nodes: configured accounts within each product
- Clicking an account **opens a WebView tab** with the credential management UI for that account/environment

### TreeView Actions

- Add/remove environments (via context menu or command palette)
- Sign in / sign out per account
- Refresh account data

---

## B.4 UX: WebView Credential Management

When the user clicks an account in the TreeView, a **WebView tab** opens displaying:

- Credentials list with search, filters, and sorting
- Credential detail view
- Key creation/regeneration modals
- All shared UI components (Lit Web Components from `packages/core`)

Each account opens in its own tab (like an editor tab).

---

## B.5 Authentication

- Use VS Code's built-in **authentication API** for OAuth flow
- Redirect URI registered per user's ArcGIS Application
- Token stored in **VS Code SecretStorage** (one per environment)

---

## B.6 Security Model

- Use `SecretStorage` for all tokens — never write to disk
- No storing API key values
- Explicit logout per account
- Clear destructive confirmations via WebView modals
- No network calls outside ArcGIS endpoints

---

## B.7 Deployment

- VS Code Marketplace policy compliance
- Explicit OAuth documentation in README
- Secure secret storage review
- Minimum VS Code version TBD (must support SecretStorage and WebView API)

---

## Part C — Chrome Extension Specification

This section covers requirements, architecture, and UX specific to the Chrome extension (Manifest V3).

---

## C.1 Development Priority

The Chrome extension is the **secondary development target**, built after the shared core and VS Code extension are stable. It wraps the same shared core and Lit WebView components.

---

## C.2 Architecture

### Extension Components

- **Popup** — minimal launcher
- **Full-tab page** — main credential management UI (shared Lit components)
- **Background Service Worker** — OAuth flow handling, token management
- **OAuth handler** — `chrome.identity.launchWebAuthFlow`

No backend server.

---

## C.3 UX: Popup (Launcher)

The popup is a **minimal launcher** with:

- Active environment selector (dropdown)
- Sign-in status
- "Open Explorer" button → opens full-tab credential management page

No credential data is displayed in the popup itself.

---

## C.4 UX: Full-Tab Credential Management

The main experience opens in a **full browser tab** (`chrome.tabs.create`), displaying:

- Environment selector
- Credentials list with search, filters, and sorting
- Credential detail view
- Key creation/regeneration modals
- All shared UI components (Lit Web Components from `packages/core`)

This is the same WebView UI used by VS Code, rendered in a Chrome tab context.

---

## C.5 Authentication

- Use `chrome.identity.launchWebAuthFlow` for OAuth PKCE flow
- Redirect URL: `https://<extension-id>.chromiumapp.org/`
- User registers this redirect URI in their ArcGIS Application
- Token stored in `chrome.storage.session` (one per environment)

---

## C.6 Token Rules

- Stored in `chrome.storage.session` only
- Never in `chrome.storage.sync` or `chrome.storage.local`
- Cleared on browser restart
- No logging of tokens

---

## C.7 Security Model

- Minimal host permissions (ArcGIS endpoints only)
- No content scripts
- No `activeTab` unless strictly necessary
- Minimal `permissions` in manifest

---

## C.8 Deployment

- Manifest V3
- Chrome Web Store compliance
- Clear permission justification in store listing
- Security review prior to release

---
