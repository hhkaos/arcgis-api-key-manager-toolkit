# ArcGIS API Key Explorer

ArcGIS API Key Explorer is a monorepo for a VS Code extension and Chrome extension that help developers securely manage their own ArcGIS API key credentials.

The project provides a shared core package for:
- ArcGIS REST client contracts and operations
- environment management
- credential filtering/sorting/expiration logic
- shared Lit Web Components for credential UI flows
- host/webview messaging protocol

## Features (In Progress)

- OAuth-ready multi-environment model:
  - ArcGIS Online
  - ArcGIS Location Platform
  - ArcGIS Enterprise
- API credential list/detail experiences (shared component layer)
- Key action flows (create/regenerate) UI contract and modal behavior
- VS Code extension scaffold with runnable TreeView and commands

## Repository Structure

```text
packages/
  core/      Shared TypeScript core logic, REST layer, messaging, Lit components
  vscode/    VS Code extension shell (CommonJS)
  chrome/    Chrome extension shell (Manifest V3 / ESM)
docs/
  SPEC.md    Functional and technical specification
  PLAN.md    Implementation plan
  TODO.md    Task tracker
```

## Prerequisites

- Node.js 20+
- npm 10+
- VS Code (for extension host testing)

## Installation

From repository root:

```bash
npm install
```

## Build

Build order matters (`core` first):

```bash
npm run build
```

Or build packages individually:

```bash
npm run build:core
npm run build:vscode
npm run build:chrome
```

## Test

Run unit tests (currently focused in `packages/core`):

```bash
npm test
```

## Run the VS Code Extension (Development)

1. Open this repository in VS Code.
2. Start debugging:
   - Windows/Linux: press `F5`
   - macOS: press `fn` + `F5` (or use **Run and Debug** from the VS Code sidebar)
3. Select `Run ArcGIS API Key Explorer (Extension)` if prompted.
4. In the Extension Development Host window, open the **ArcGIS API Keys** view in the Activity Bar.

Current VS Code extension behavior is scaffold-level and intended for iterative development/testing while core features are being wired.

## ArcGIS OAuth Client Setup (Required for Sign-In)

You must create your own ArcGIS OAuth application and use its client ID in the extension.

1. In ArcGIS (your target environment), create a new OAuth application.
2. Enable OAuth 2.0 Authorization Code flow (PKCE/no client secret for this extension flow).
3. Add redirect URI(s):
   - VS Code Stable: `vscode://local-dev.arcgis-api-key-explorer/auth-callback`
   - VS Code Insiders (if you use it): `vscode-insiders://local-dev.arcgis-api-key-explorer/auth-callback`
   - Chrome extension (required for Chrome sign-in): `https://<chrome-extension-id>.chromiumapp.org/`
4. Save the app and copy the generated client ID.
5. In the Extension Development Host, run **ArcGIS API Keys: Add Environment** and paste that client ID.

Notes:
- The extension ID used in redirects is `<publisher>.<name>` from `packages/vscode/package.json`.
- In this repo today, that is `local-dev.arcgis-api-key-explorer`.
- If you change `publisher` or `name`, update redirect URI(s) to match.

### Chrome Redirect URL Setup

When using the Chrome extension, ArcGIS must allow the exact redirect URL used by `chrome.identity.launchWebAuthFlow`.

1. Build Chrome extension assets:
   - `npm run build:core`
   - `npm run build:chrome`
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `packages/chrome/dist`.
5. Copy the extension ID shown on the extension card.
6. In your ArcGIS OAuth app, add this redirect URI exactly:
   - `https://<that-extension-id>.chromiumapp.org/`
7. Save the ArcGIS app changes.
8. In the extension popup, add an environment with that ArcGIS app's client ID and sign in.

Important:
- The redirect URI must be an exact match, including protocol, host, and trailing slash.
- If the Chrome extension ID changes, update the ArcGIS app redirect URI to the new `chromiumapp.org` URL.

## Lint and Format

```bash
npm run lint
npm run format
```

## Security and Scope Notes

- No bundled/shared OAuth client IDs; users provide their own.
- Client-only architecture (no backend service).
- No telemetry/analytics collection.
- OAuth tokens are intended to be stored with platform-appropriate secure storage.
- API key values are treated as one-time display outputs in UI flow design.

## Project Status

Implementation is in active development. See `docs/TODO.md` for progress and `docs/SPEC.md` for behavior and constraints.
