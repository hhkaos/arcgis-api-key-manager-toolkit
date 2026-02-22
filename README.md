# ArcGIS API Key Explorer

ArcGIS API Key Explorer is a monorepo for a VS Code extension and Chrome extension that help developers securely manage their own ArcGIS API key credentials.

The project provides a shared core package for:

- ArcGIS REST client contracts and operations
- environment management
- credential filtering/sorting/expiration logic
- shared Lit Web Components for credential UI flows
- host/webview messaging protocol

## Features

- OAuth 2.0 sign-in across ArcGIS Online, Location Platform, and Enterprise environments
- Searchable, filterable, sortable credential list with per-slot expiration badges
- Full credential detail view: privileges, referrer analysis, key slot status
- API key create / regenerate / revoke flows with confirmation modal and one-click copy
- Settings deep-links to the ArcGIS item page for each credential
- Automatic VS Code theme adoption (`--vscode-*` tokens)

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

## Try It Out

Download the latest release from the **Releases** page of this repository and follow the steps below for your platform.

> **VS Code Marketplace / Chrome Web Store:** I'm considering publishing to both stores. In the meantime, use the GitHub Releases artifacts below.

### Install the VS Code Extension

1. Download `arcgis-api-key-explorer-X.X.X.vsix` from the Releases page.
2. Open VS Code and go to the **Extensions** view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the `···` menu (top-right of the Extensions panel) → **Install from VSIX…**
4. Select the downloaded `.vsix` file.
5. Reload VS Code when prompted.
6. Open the **ArcGIS API Keys** view in the Activity Bar.
7. Run **ArcGIS API Keys: Add Environment**, enter your OAuth client ID, and sign in.

> **OAuth setup required:** You must register a redirect URI in your ArcGIS OAuth app before sign-in will work. See [ArcGIS OAuth Client Setup](#arcgis-oauth-client-setup-required-for-sign-in) below.

### Load the Chrome Extension

1. Download `arcgis-api-key-explorer-chrome-vX.X.X.zip` from the Releases page.
2. Unzip it to a folder on your machine.
3. Open `chrome://extensions` and enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and select the unzipped folder.
5. Click the ArcGIS API Key Explorer icon in your Chrome toolbar (or pin it from the puzzle-piece menu).
6. In the popup, add an environment with your OAuth client ID and sign in.

> **OAuth setup required:** The Chrome extension needs a `chromiumapp.org` redirect URI added to your ArcGIS OAuth app. See [Chrome Redirect URL Setup](#chrome-redirect-url-setup) below.

## ArcGIS OAuth Client Setup (Required for Sign-In)

You must create your own ArcGIS OAuth application and use its client ID in the extension.

1. In ArcGIS (your target environment), create a new OAuth application.
2. Enable OAuth 2.0 Authorization Code flow (PKCE/no client secret for this extension flow).
3. Add redirect URI(s):
   - VS Code Stable: `vscode://hhkaos.arcgis-api-key-explorer/auth-callback`
   - VS Code Insiders (if you use it): `vscode-insiders://hhkaos.arcgis-api-key-explorer/auth-callback`
   - Chrome extension (required for Chrome sign-in): `https://<chrome-extension-id>.chromiumapp.org/`
4. Save the app and copy the generated client ID.
5. In the extension, open the **ArcGIS API Keys** view, run **Add Environment**, and paste the client ID.

> The VS Code extension ID used in redirect URIs is `<publisher>.<name>` from `packages/vscode/package.json`, currently `hhkaos.arcgis-api-key-explorer`. If you fork and change `publisher` or `name`, update the redirect URIs to match.

### Chrome Redirect URL Setup

The Chrome extension uses `chrome.identity.launchWebAuthFlow`, which requires a `chromiumapp.org` redirect URI registered in your ArcGIS OAuth app.

1. Load the extension (see [Load the Chrome Extension](#load-the-chrome-extension) above).
2. Open `chrome://extensions` and copy the **extension ID** from the extension card.
3. In your ArcGIS OAuth app, add this redirect URI exactly:
   - `https://<that-extension-id>.chromiumapp.org/`
4. Save the ArcGIS app changes.

> The redirect URI must be an exact match including protocol, host, and trailing slash. If the extension ID changes (e.g., after reloading from a different path), update the ArcGIS app redirect URI to the new value.

## Security and Scope Notes

- No bundled/shared OAuth client IDs; users provide their own.
- Client-only architecture (no backend service).
- No telemetry/analytics collection.
- OAuth tokens are intended to be stored with platform-appropriate secure storage.
- API key values are treated as one-time display outputs in UI flow design.

## Project Status

The core feature set is implemented. See [docs/TODO.md](docs/TODO.md) for task progress and [docs/SPEC.md](docs/SPEC.md) for the full functional specification.

## Contributing

Interested in building from source, running tests, or contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, debugging, OAuth dev config, and commit conventions.
