import {
  deserializeMessage,
  serializeMessage,
  type ApiKeyCredential,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from '@arcgis-api-keys/core';
import '@arcgis-api-keys/core';

interface VsCodeApi {
  postMessage(message: string): void;
  setState(state: unknown): void;
  getState(): unknown;
}

declare const acquireVsCodeApi: () => VsCodeApi;

type AuthState = 'checking' | 'logged-out' | 'logging-in' | 'logged-in' | 'logging-out';

type CredentialListElement = HTMLElement & {
  credentials: ApiKeyCredential[];
  selectedCredentialId: string | null;
  loading: boolean;
  errorMessage: string;
};

type CredentialDetailElement = HTMLElement & {
  credential: ApiKeyCredential | null;
  loading: boolean;
  errorMessage: string;
};

type KeyActionModalElement = HTMLElement & {
  open: boolean;
  loading: boolean;
  errorMessage: string;
  credentialId: string;
  credentialName: string;
  keySlot: 1 | 2;
  action: 'create' | 'regenerate';
  existingPartialId: string;
  existingCreated: string;
  resultKey: string | null;
};

const vscode = acquireVsCodeApi();

class ArcgisApiKeysAppElement extends HTMLElement {
  private readonly statusEl = document.createElement('p');
  private readonly infoEl = document.createElement('p');
  private readonly errorEl = document.createElement('p');
  private readonly actionsEl = document.createElement('div');
  private readonly signInButton = document.createElement('button');
  private readonly signOutButton = document.createElement('button');
  private readonly refreshButton = document.createElement('button');
  private readonly credentialsEl = document.createElement('credential-list') as CredentialListElement;
  private readonly detailEl = document.createElement('credential-detail') as CredentialDetailElement;
  private readonly modalEl = document.createElement('key-action-modal') as KeyActionModalElement;

  private authState: AuthState = 'checking';
  private credentials: ApiKeyCredential[] = [];
  private selectedCredentialId: string | null = null;
  private selectedCredential: ApiKeyCredential | null = null;

  public connectedCallback(): void {
    this.render();
    this.post({ type: 'webview/initialize', payload: {} });
  }

  private render(): void {
    const root = document.createElement('div');
    root.style.fontFamily = "var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif)";
    root.style.padding = '12px';
    root.style.display = 'grid';
    root.style.gap = '10px';
    root.style.background = 'var(--vscode-sideBar-background, #f7fafc)';
    root.style.border = '1px solid var(--vscode-panel-border, #c6d0db)';
    root.style.color = 'var(--vscode-editor-foreground, #18202a)';

    const title = document.createElement('h2');
    title.textContent = this.dataset.environmentName
      ? `ArcGIS API Keys - ${this.dataset.environmentName}`
      : 'ArcGIS API Keys';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.color = 'var(--vscode-editor-foreground, #18202a)';

    this.statusEl.style.margin = '0';

    this.infoEl.textContent =
      'Credential list/detail and key actions are now wired through the extension host.';
    this.infoEl.style.margin = '0';
    this.infoEl.style.color = 'var(--vscode-descriptionForeground, #4d5a69)';
    this.infoEl.style.fontSize = '12px';

    this.errorEl.style.margin = '0';
    this.errorEl.style.color = 'var(--vscode-errorForeground, #b42318)';
    this.errorEl.style.fontWeight = '600';
    this.errorEl.style.fontSize = '12px';
    this.errorEl.hidden = true;

    this.actionsEl.style.display = 'flex';
    this.actionsEl.style.alignItems = 'center';
    this.actionsEl.style.gap = '6px';
    this.actionsEl.style.flexWrap = 'wrap';

    setupButton(this.signInButton, 'Sign in with ArcGIS');
    setupButton(this.signOutButton, 'Sign out');
    setupButton(this.refreshButton, 'Refresh Credentials');

    this.signInButton.addEventListener('click', () => {
      this.clearError();
      this.authState = 'logging-in';
      this.syncUiState();
      this.post({ type: 'webview/sign-in', payload: {} });
    });

    this.signOutButton.addEventListener('click', () => {
      this.clearError();
      this.authState = 'logging-out';
      this.syncUiState();
      this.post({ type: 'webview/sign-out', payload: {} });
    });

    this.refreshButton.addEventListener('click', () => {
      this.loadCredentials();
    });

    this.credentialsEl.addEventListener('credential-refresh', () => {
      this.loadCredentials();
    });

    this.credentialsEl.addEventListener('credential-select', (event: Event) => {
      const detail = (event as CustomEvent<{ credentialId: string }>).detail;
      if (!detail?.credentialId) {
        return;
      }

      this.selectedCredentialId = detail.credentialId;
      this.credentialsEl.selectedCredentialId = detail.credentialId;
      this.detailEl.loading = true;
      this.detailEl.errorMessage = '';

      this.post({
        type: 'webview/load-credential-detail',
        payload: { credentialId: detail.credentialId }
      });
    });

    this.detailEl.addEventListener('key-action-request', (event: Event) => {
      const detail = (event as CustomEvent<{ credentialId: string; slot: 1 | 2; action: 'create' | 'regenerate' }>).detail;
      if (!detail || !this.selectedCredential) {
        return;
      }

      const slotState = detail.slot === 1 ? this.selectedCredential.key1 : this.selectedCredential.key2;

      this.modalEl.open = true;
      this.modalEl.loading = false;
      this.modalEl.errorMessage = '';
      this.modalEl.resultKey = null;
      this.modalEl.credentialId = detail.credentialId;
      this.modalEl.credentialName = this.selectedCredential.name;
      this.modalEl.keySlot = detail.slot;
      this.modalEl.action = detail.action;
      this.modalEl.existingPartialId = slotState.partialId ?? '';
      this.modalEl.existingCreated = slotState.created ?? '';
    });

    this.modalEl.addEventListener('key-action-close', () => {
      this.modalEl.open = false;
    });

    this.modalEl.addEventListener('key-action-execute', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        slot: 1 | 2;
        action: 'create' | 'regenerate';
        expirationDays?: number;
      }>).detail;

      this.modalEl.loading = true;
      this.modalEl.errorMessage = '';
      this.post({
        type: 'webview/key-action',
        payload: {
          credentialId: detail.credentialId,
          slot: detail.slot,
          action: detail.action,
          expirationDays: detail.expirationDays
        }
      });
    });

    this.credentialsEl.credentials = [];
    this.credentialsEl.selectedCredentialId = null;
    this.credentialsEl.loading = false;
    this.credentialsEl.errorMessage = '';

    this.detailEl.credential = null;
    this.detailEl.loading = false;
    this.detailEl.errorMessage = '';

    this.modalEl.open = false;
    this.modalEl.loading = false;
    this.modalEl.errorMessage = '';
    this.modalEl.resultKey = null;

    this.actionsEl.append(this.signInButton, this.signOutButton, this.refreshButton);

    root.append(title, this.statusEl, this.infoEl, this.errorEl, this.actionsEl, this.credentialsEl, this.detailEl, this.modalEl);

    this.replaceChildren(root);
    this.syncUiState();
  }

  public handleHostMessage(message: HostToWebviewMessage): void {
    if (message.type === 'host/state') {
      this.clearError();
      this.authState = message.payload.signedIn ? 'logged-in' : 'logged-out';
      this.syncUiState();

      if (message.payload.signedIn) {
        this.loadCredentials();
      } else {
        this.clearCredentialState();
      }

      return;
    }

    if (message.type === 'host/error') {
      if (this.authState === 'logging-in' || this.authState === 'checking') {
        this.authState = 'logged-out';
      }

      if (this.authState === 'logging-out') {
        this.authState = 'logged-in';
      }

      const suffix = message.payload.code ? ` (${message.payload.code})` : '';
      this.errorEl.hidden = false;
      this.errorEl.textContent = `${message.payload.message}${suffix}`;
      this.statusEl.textContent = this.authState === 'logged-in' ? 'Signed in.' : 'Not signed in.';
      this.credentialsEl.loading = false;
      this.detailEl.loading = false;
      this.modalEl.loading = false;
      this.modalEl.errorMessage = message.payload.message;
      this.syncUiState();
      return;
    }

    if (message.type === 'host/credentials') {
      this.clearError();
      this.authState = 'logged-in';
      this.credentials = message.payload.credentials;
      this.credentialsEl.loading = false;
      this.credentialsEl.errorMessage = '';
      this.credentialsEl.credentials = this.credentials;

      if (!this.selectedCredentialId || !this.credentials.some((item) => item.id === this.selectedCredentialId)) {
        this.selectedCredentialId = this.credentials[0]?.id ?? null;
      }

      this.credentialsEl.selectedCredentialId = this.selectedCredentialId;
      this.statusEl.textContent = `Loaded ${message.payload.credentials.length} credentials.`;

      if (this.selectedCredentialId) {
        this.detailEl.loading = true;
        this.detailEl.errorMessage = '';
        this.post({
          type: 'webview/load-credential-detail',
          payload: { credentialId: this.selectedCredentialId }
        });
      } else {
        this.detailEl.credential = null;
        this.detailEl.loading = false;
      }

      this.syncUiState();
      return;
    }

    if (message.type === 'host/credential-detail') {
      this.selectedCredential = message.payload.credential;
      this.detailEl.credential = message.payload.credential;
      this.detailEl.loading = false;
      this.detailEl.errorMessage = '';
      this.statusEl.textContent = `Viewing ${message.payload.credential.name}.`;
      return;
    }

    if (message.type === 'host/key-action-result') {
      this.modalEl.loading = false;
      this.modalEl.errorMessage = '';
      this.modalEl.resultKey = message.payload.result.key;
      this.statusEl.textContent = `Key action complete for slot ${message.payload.result.slot}.`;
    }
  }

  private syncUiState(): void {
    const isBusy =
      this.authState === 'checking' || this.authState === 'logging-in' || this.authState === 'logging-out';

    this.signInButton.hidden = !(this.authState === 'logged-out' || this.authState === 'logging-in');
    this.signOutButton.hidden = !(this.authState === 'logged-in' || this.authState === 'logging-out');
    this.refreshButton.hidden = this.authState !== 'logged-in';

    this.signInButton.disabled = isBusy;
    this.signOutButton.disabled = isBusy;
    this.refreshButton.disabled = isBusy;

    this.credentialsEl.hidden = this.authState !== 'logged-in';
    this.detailEl.hidden = this.authState !== 'logged-in';

    if (this.authState === 'checking') {
      this.statusEl.textContent = 'Checking sign-in status...';
    } else if (this.authState === 'logged-out') {
      this.statusEl.textContent = 'Not signed in.';
    } else if (this.authState === 'logging-in') {
      this.statusEl.textContent = 'Signing in...';
    } else if (this.authState === 'logged-in') {
      if (!this.statusEl.textContent) {
        this.statusEl.textContent = 'Signed in.';
      }
    } else if (this.authState === 'logging-out') {
      this.statusEl.textContent = 'Signing out...';
    }
  }

  private loadCredentials(): void {
    this.clearError();
    this.credentialsEl.loading = true;
    this.credentialsEl.errorMessage = '';
    this.statusEl.textContent = 'Loading credentials...';
    this.post({ type: 'webview/load-credentials', payload: { refresh: true } });
  }

  private clearCredentialState(): void {
    this.credentials = [];
    this.selectedCredentialId = null;
    this.selectedCredential = null;

    this.credentialsEl.credentials = [];
    this.credentialsEl.selectedCredentialId = null;
    this.credentialsEl.loading = false;
    this.credentialsEl.errorMessage = '';

    this.detailEl.credential = null;
    this.detailEl.loading = false;
    this.detailEl.errorMessage = '';

    this.modalEl.open = false;
    this.modalEl.loading = false;
    this.modalEl.errorMessage = '';
    this.modalEl.resultKey = null;
  }

  private post(message: WebviewToHostMessage): void {
    vscode.postMessage(serializeMessage(message));
  }

  private clearError(): void {
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }
}

function setupButton(button: HTMLButtonElement, label: string): void {
  button.type = 'button';
  button.textContent = label;
  button.style.width = 'max-content';
  button.style.border = '1px solid var(--vscode-button-border, var(--vscode-button-background, #0b63ce))';
  button.style.borderRadius = '0';
  button.style.padding = '7px 9px';
  button.style.minHeight = '33px';
  button.style.fontSize = '12px';
  button.style.fontFamily = "var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif)";
  button.style.background = 'var(--vscode-button-secondaryBackground, var(--vscode-editor-background, #ffffff))';
  button.style.cursor = 'pointer';
  button.style.color = 'var(--vscode-button-secondaryForeground, var(--vscode-editor-foreground, #18202a))';
}

if (!customElements.get('arcgis-api-keys-app')) {
  customElements.define('arcgis-api-keys-app', ArcgisApiKeysAppElement);
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (typeof event.data !== 'string') {
    return;
  }

  try {
    const parsed = deserializeMessage(event.data);
    if (!parsed.type.startsWith('host/')) {
      return;
    }

    const app = document.querySelector<ArcgisApiKeysAppElement>('arcgis-api-keys-app');
    app?.handleHostMessage(parsed as HostToWebviewMessage);
  } catch {
    // Ignore malformed host messages.
  }
});
