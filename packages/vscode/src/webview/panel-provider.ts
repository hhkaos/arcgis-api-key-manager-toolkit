import {
  deserializeMessage,
  serializeMessage,
  type EnvironmentConfig,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from '@arcgis-api-keys/core';
import * as vscode from 'vscode';

export interface WebviewMessageContext {
  environment: EnvironmentConfig;
  panel: vscode.WebviewPanel;
  message: WebviewToHostMessage;
}

export type WebviewMessageHandler = (context: WebviewMessageContext) => Promise<void> | void;

export class AccountWebviewPanelProvider {
  private readonly extensionUri: vscode.Uri;
  private readonly onMessage: WebviewMessageHandler;
  private readonly panelByEnvironmentId = new Map<string, vscode.WebviewPanel>();

  public constructor(extensionUri: vscode.Uri, onMessage: WebviewMessageHandler) {
    this.extensionUri = extensionUri;
    this.onMessage = onMessage;
  }

  public open(environment: EnvironmentConfig): vscode.WebviewPanel {
    const existing = this.panelByEnvironmentId.get(environment.id);
    if (existing) {
      existing.reveal(vscode.ViewColumn.One);
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      'arcgisApiKeys.account',
      `ArcGIS API Keys: ${environment.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')]
      }
    );

    panel.iconPath = {
      light: vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.svg'),
      dark: vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.svg')
    };

    panel.webview.html = this.renderHtml(panel.webview, environment);

    panel.onDidDispose(() => {
      this.panelByEnvironmentId.delete(environment.id);
    });

    panel.webview.onDidReceiveMessage(async (raw) => {
      if (typeof raw !== 'string') {
        return;
      }

      try {
        const message = deserializeMessage(raw);
        if (!message.type.startsWith('webview/')) {
          return;
        }

        await this.onMessage({ environment, panel, message });
      } catch {
        this.post(panel, {
          type: 'host/error',
          payload: {
            message: 'Invalid message from WebView.',
            recoverable: true
          }
        });
      }
    });

    this.panelByEnvironmentId.set(environment.id, panel);
    return panel;
  }

  public post(panel: vscode.WebviewPanel, message: HostToWebviewMessage): void {
    void panel.webview.postMessage(serializeMessage(message));
  }

  public postToEnvironment(environmentId: string, message: HostToWebviewMessage): void {
    const panel = this.panelByEnvironmentId.get(environmentId);
    if (!panel) {
      return;
    }

    this.post(panel, message);
  }

  private renderHtml(webview: vscode.Webview, environment: EnvironmentConfig): string {
    const nonce = createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-ui.js'));

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <title>ArcGIS API Keys</title>
    <style>
      body {
        margin: 0;
        background: var(--vscode-sideBar-background);
        color: var(--vscode-editor-foreground);
        font-family: var(--vscode-font-family);
      }
    </style>
  </head>
  <body>
    <arcgis-api-keys-app data-environment-name="${escapeHtml(environment.name)}"></arcgis-api-keys-app>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 24; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
