# Contributing

This repository is a monorepo with three workspaces:

- `packages/core` — shared logic, REST layer, messaging, Lit components
- `packages/vscode` — VS Code extension shell
- `packages/chrome` — Chrome extension shell

## Prerequisites

- Node.js 20+
- npm 10+
- VS Code

## Setup

```bash
npm install
```

## Build and Test

Build all workspaces:

```bash
npm run build
```

Build individually:

```bash
npm run build:core
npm run build:vscode
npm run build:chrome
```

Run tests:

```bash
npm test
```

## Running the VS Code Extension

1. Open the repo in VS Code.
2. Start debug:
   - Windows/Linux: `F5`
   - macOS: `fn` + `F5` (or Run and Debug panel)
3. Use configuration `Run ArcGIS API Key Explorer (Extension)`.
4. In the Extension Development Host, open the **ArcGIS API Keys** view.

## Debugging HTTP Requests/Responses

HTTP calls are executed in the **extension host process**, not in WebView JS.  
Because of that, WebView DevTools Network tab may not show ArcGIS requests.

Use Output logs instead:

1. In Extension Development Host, open `View` -> `Output`.
2. Select output channel: `ArcGIS API Key Explorer`.

### Verbose HTTP Logging Toggle

The extension provides a setting:

- `arcgisApiKeys.debug.verboseHttpLogging` (default: `false`)

Enable it in Extension Development Host settings to log redacted request/response payloads.

Steps:
1. In the Extension Development Host window, open Settings (`Cmd+,` on macOS or `Ctrl+,` on Windows/Linux).
2. Search for `verboseHttpLogging`.
3. Enable `Arcgis Api Keys > Debug: Verbose Http Logging`.
4. Open `View` -> `Output`.
5. Select output channel `ArcGIS API Key Explorer`.
6. Trigger `Refresh Credentials` in the ArcGIS API Keys WebView.

Example screenshot (place the file at the path below):

![Enable verbose HTTP logging in Extension Development Host](docs/images/extension-development-host-verbose-http-logging.png)

What it logs:
- request method/path/environment
- request query/body (redacted)
- response payload (redacted)
- mapped error payloads (redacted)

Sensitive fields (`token`, `authorization`, `key`, etc.) are redacted in verbose output.

## OAuth Notes

- Developers must provide their own ArcGIS OAuth client ID.
- The VS Code extension ID is `<publisher>.<name>` from `packages/vscode/package.json`, currently `hhkaos.arcgis-api-key-explorer`.
- Register these redirect URI(s) in your ArcGIS OAuth app:
  - `vscode://hhkaos.arcgis-api-key-explorer/auth-callback`
  - `vscode-insiders://hhkaos.arcgis-api-key-explorer/auth-callback` (if needed)
- If you fork and change `publisher` or `name`, update redirect URI(s) to match.

## Running the Chrome Extension Locally

You do not need a published Chrome Web Store extension to test OAuth.

Important:
- Chrome extension OAuth does not use `localhost` redirect URLs.
- `chrome.identity.launchWebAuthFlow` requires a redirect URL in this format:
  - `https://<extension-id>.chromiumapp.org/`

Local development steps:
1. Build the extension:
   - `npm run build:core`
   - `npm run build:chrome`
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select `packages/chrome/dist`.
5. Copy the generated extension ID from the extension card.
6. In your ArcGIS OAuth app, add redirect URI:
   - `https://<that-extension-id>.chromiumapp.org/`
7. Save the ArcGIS app settings.
8. Open the extension popup, add environment + client ID, then sign in.

Notes:
- Redirect URL must match exactly (including `https` and trailing slash).
- If extension ID changes (e.g., reloaded from a different path/profile), update the ArcGIS redirect URI.

## Scope and Current Implementation Notes

- Current list loading is intentionally scoped to API keys endpoint (`/portals/self/apiKeys`).
- Support for other developer credential types is planned for future enhancement.

## Security and Logging Rules

Do not log:
- access tokens
- API key values
- full sensitive credential payloads without redaction

If adding new diagnostics, keep redaction in place and prefer temporary logs for troubleshooting.

## Lint and Format

```bash
npm run lint
npm run format
```

## Local Packaging

To produce the installable artifacts locally (without pushing a release tag):

```bash
npm run package:vscode   # → packages/vscode/arcgis-api-key-explorer-X.X.X.vsix
npm run package:chrome   # → packages/chrome/arcgis-api-key-explorer-chrome-vX.X.X.zip
```

Both scripts rebuild their dependencies from source before packaging.

## Commit and Documentation Expectations

- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Update docs when behavior changes (`README.md`, `docs/TODO.md`, `docs/SPEC.md` as applicable).
- Stage files explicitly by name (do not use blanket staging commands).
