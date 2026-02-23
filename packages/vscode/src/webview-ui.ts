import {
  deserializeMessage,
  serializeMessage,
  type ApiKeyCredential,
  type EnvironmentConfig,
  type EnvironmentType,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from '@arcgis-api-keys/core';
import '@arcgis-api-keys/core/components';
import { shouldShowSignInDisclaimer } from './ui-state.js';

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
  portalBase: string;
  availableTags: string[];
};

type CredentialDetailElement = HTMLElement & {
  credential: ApiKeyCredential | null;
  loading: boolean;
  errorMessage: string;
  portalBase: string;
  environmentType: EnvironmentType | null;
  availableTags: string[];
  handleDeleteCheckResult?: (canDelete: boolean) => void;
  handleCredentialDeleted?: () => void;
  handleOperationError?: (message: string) => void;
};

type KeyActionModalElement = HTMLElement & {
  open: boolean;
  loading: boolean;
  errorMessage: string;
  credentialId: string;
  credentialName: string;
  keySlot: 1 | 2;
  action: 'create' | 'regenerate' | 'revoke';
  existingPartialId: string;
  existingCreated: string;
  resultKey: string | null;
};

const vscode = acquireVsCodeApi();

class ArcgisApiKeysAppElement extends HTMLElement {
  private readonly statusEl = document.createElement('p');
  private readonly disclaimerEl = document.createElement('p');
  private readonly acknowledgeLabelEl = document.createElement('label');
  private readonly acknowledgeCheckboxEl = document.createElement('input');
  private readonly loadingEl = document.createElement('div');
  private readonly infoEl = document.createElement('p');
  private readonly warningEl = document.createElement('p');
  private readonly errorEl = document.createElement('p');
  private readonly headerEl = document.createElement('div');
  private readonly headerActionsEl = document.createElement('div');
  private readonly actionsEl = document.createElement('div');
  private readonly createApiKeyLink = document.createElement('a');
  private readonly signInButton = document.createElement('button');
  private readonly signOutButton = document.createElement('button');
  private readonly refreshButton = document.createElement('button');
  private readonly backButton = document.createElement('button');
  private readonly credentialsEl = document.createElement('credential-list') as CredentialListElement;
  private readonly detailEl = document.createElement('credential-detail') as CredentialDetailElement;
  private readonly modalEl = document.createElement('key-action-modal') as KeyActionModalElement;

  private authState: AuthState = 'checking';
  private credentials: ApiKeyCredential[] = [];
  private selectedCredentialId: string | null = null;
  private selectedCredential: ApiKeyCredential | null = null;
  private detailMode: boolean = false;
  private environments: EnvironmentConfig[] = [];
  private activeEnvironmentId: string | null = null;
  private createApiKeyUrl: string | null = null;

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
      ? `${this.dataset.environmentName} API keys`
      : 'ArcGIS API Keys';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.color = 'var(--vscode-editor-foreground, #18202a)';

    this.headerEl.style.display = 'flex';
    this.headerEl.style.alignItems = 'center';
    this.headerEl.style.justifyContent = 'space-between';
    this.headerEl.style.gap = '8px';
    this.headerEl.style.flexWrap = 'wrap';

    this.headerActionsEl.style.display = 'flex';
    this.headerActionsEl.style.alignItems = 'center';
    this.headerActionsEl.style.gap = '6px';
    this.headerActionsEl.style.flexWrap = 'wrap';
    this.headerActionsEl.addEventListener('click', (event: Event) => this.handleExternalLinkClick(event), true);

    this.statusEl.style.margin = '0';

    this.disclaimerEl.style.margin = '0';
    this.disclaimerEl.style.padding = '8px';
    this.disclaimerEl.style.display = 'flex';
    this.disclaimerEl.style.alignItems = 'flex-start';
    this.disclaimerEl.style.gap = '6px';
    this.disclaimerEl.style.borderLeft = '3px solid var(--vscode-editorWarning-foreground, #8a4b00)';
    this.disclaimerEl.style.fontSize = '12px';
    this.disclaimerEl.style.lineHeight = '1.4';
    this.disclaimerEl.innerHTML =
      '<akm-icon name="alert-triangle" size="14" label="Warning"></akm-icon><span>This is not an official Esri project or maintained by Esri, so <strong>use it at your own risk</strong>. It is an experimental side project made for fun and for personal use. If you still decide to use it, I would love to hear your opinion at <a href="https://github.com/hhkaos/arcgis-api-key-manager-toolkit/issues" target="_blank" rel="noopener noreferrer">issues</a>.</span>';
    this.disclaimerEl.addEventListener('click', (event: Event) => this.handleExternalLinkClick(event), true);

    this.acknowledgeCheckboxEl.type = 'checkbox';
    this.acknowledgeCheckboxEl.style.margin = '2px 0 0 0';
    this.acknowledgeCheckboxEl.addEventListener('change', () => {
      this.syncUiState();
    });
    this.acknowledgeLabelEl.style.display = 'flex';
    this.acknowledgeLabelEl.style.alignItems = 'flex-start';
    this.acknowledgeLabelEl.style.gap = '6px';
    this.acknowledgeLabelEl.style.fontSize = '12px';
    this.acknowledgeLabelEl.style.lineHeight = '1.4';
    this.acknowledgeLabelEl.style.cursor = 'pointer';
    const ackSpan = document.createElement('span');
    ackSpan.textContent = 'I have read the warning message above and I understand I want to proceed.';
    this.acknowledgeLabelEl.append(this.acknowledgeCheckboxEl, ackSpan);

    this.loadingEl.style.display = 'none';
    this.loadingEl.style.alignItems = 'center';
    this.loadingEl.style.gap = '8px';
    this.loadingEl.style.fontSize = '12px';
    this.loadingEl.style.color = 'var(--vscode-descriptionForeground, #4d5a69)';
    this.loadingEl.innerHTML =
      '<progress style="width: 120px;"></progress><span>Loading API keys...</span>';

    this.infoEl.textContent =
      'Credential list/detail and key actions are now wired through the extension host.';
    this.infoEl.style.margin = '0';
    this.infoEl.style.color = 'var(--vscode-descriptionForeground, #4d5a69)';
    this.infoEl.style.fontSize = '12px';

    this.warningEl.style.margin = '0';
    this.warningEl.style.color = 'var(--vscode-editorWarning-foreground, #8a4b00)';
    this.warningEl.style.fontWeight = '600';
    this.warningEl.style.fontSize = '12px';
    this.warningEl.hidden = true;

    this.errorEl.style.margin = '0';
    this.errorEl.style.color = 'var(--vscode-errorForeground, #b42318)';
    this.errorEl.style.fontWeight = '600';
    this.errorEl.style.fontSize = '12px';
    this.errorEl.hidden = true;

    this.actionsEl.style.display = 'flex';
    this.actionsEl.style.alignItems = 'center';
    this.actionsEl.style.gap = '6px';
    this.actionsEl.style.flexWrap = 'wrap';

    setupPrimaryLink(this.createApiKeyLink, 'Create API key', 'external-link', 'end');
    setupButton(this.signInButton, 'Sign in with ArcGIS', 'user');
    setupButton(this.signOutButton, 'Sign out', 'arrow-right-from-bracket');
    setupButton(this.refreshButton, 'Refresh Credentials', 'rotate-ccw');
    setupButton(this.backButton, 'Back to List', 'arrow-left', 'start');
    this.backButton.style.background = 'var(--vscode-button-background, #0b63ce)';
    this.backButton.style.color = 'var(--vscode-button-foreground, #ffffff)';
    this.backButton.style.borderColor = 'var(--vscode-button-background, #0b63ce)';
    this.backButton.style.fontWeight = '700';

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
    this.backButton.addEventListener('click', () => {
      this.detailMode = false;
      this.syncUiState();
      this.statusEl.textContent = `Loaded ${this.credentials.length} credentials.`;
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
      this.detailMode = true;
      this.syncUiState();

      this.post({
        type: 'webview/load-credential-detail',
        payload: { credentialId: detail.credentialId }
      });
    });
    this.credentialsEl.addEventListener('click', (event: Event) => this.handleExternalLinkClick(event), true);

    this.credentialsEl.addEventListener('fetch-user-tags', () => {
      this.post({ type: 'webview/fetch-user-tags', payload: {} });
    });

    this.credentialsEl.addEventListener('credential-update-request', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        title: string;
        snippet: string;
        tags: string[];
      }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/update-credential-metadata',
        payload: {
          credentialId: detail.credentialId,
          title: detail.title,
          snippet: detail.snippet,
          tags: detail.tags
        }
      });
    });

    this.detailEl.addEventListener('click', (event: Event) => this.handleExternalLinkClick(event), true);

    this.detailEl.addEventListener('key-action-request', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        slot: 1 | 2;
        action: 'create' | 'regenerate' | 'revoke';
      }>).detail;
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

    this.detailEl.addEventListener('fetch-user-tags', () => {
      this.post({ type: 'webview/fetch-user-tags', payload: {} });
    });

    this.detailEl.addEventListener('credential-update-request', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        title: string;
        snippet: string;
        tags: string[];
      }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/update-credential-metadata',
        payload: {
          credentialId: detail.credentialId,
          title: detail.title,
          snippet: detail.snippet,
          tags: detail.tags
        }
      });
    });

    this.detailEl.addEventListener('credential-referrers-update-request', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        referrers: string[];
      }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/update-credential-referrers',
        payload: {
          credentialId: detail.credentialId,
          referrers: detail.referrers
        }
      });
    });

    this.detailEl.addEventListener('credential-delete-protection-toggle-request', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        protect: boolean;
      }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/toggle-credential-delete-protection',
        payload: {
          credentialId: detail.credentialId,
          protect: detail.protect
        }
      });
    });

    this.detailEl.addEventListener('credential-favorite-toggle-request', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        favorite: boolean;
      }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/toggle-credential-favorite',
        payload: {
          credentialId: detail.credentialId,
          favorite: detail.favorite
        }
      });
    });

    this.detailEl.addEventListener('credential-delete-check-request', (event: Event) => {
      const detail = (event as CustomEvent<{ credentialId: string }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/check-credential-delete',
        payload: {
          credentialId: detail.credentialId
        }
      });
    });

    this.detailEl.addEventListener('credential-delete-execute-request', (event: Event) => {
      const detail = (event as CustomEvent<{ credentialId: string }>).detail;
      if (!detail) {
        return;
      }

      this.post({
        type: 'webview/delete-credential',
        payload: {
          credentialId: detail.credentialId
        }
      });
    });

    this.modalEl.addEventListener('key-action-close', () => {
      this.modalEl.open = false;
    });

    this.modalEl.addEventListener('key-action-execute', (event: Event) => {
      const detail = (event as CustomEvent<{
        credentialId: string;
        slot: 1 | 2;
        action: 'create' | 'regenerate' | 'revoke';
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
          expirationDays:
            typeof detail.expirationDays === 'number' && detail.expirationDays > 0
              ? detail.expirationDays
              : undefined
        }
      });
    });

    this.credentialsEl.credentials = [];
    this.credentialsEl.selectedCredentialId = null;
    this.credentialsEl.loading = false;
    this.credentialsEl.errorMessage = '';
    this.credentialsEl.availableTags = [];
    this.credentialsEl.style.display = '';

    this.detailEl.credential = null;
    this.detailEl.loading = false;
    this.detailEl.errorMessage = '';
    this.detailEl.portalBase = '';
    this.detailEl.environmentType = null;
    this.detailEl.availableTags = [];
    this.createApiKeyUrl = null;
    this.syncCreateApiKeyLink();
    this.detailEl.style.display = 'none';

    this.modalEl.open = false;
    this.modalEl.loading = false;
    this.modalEl.errorMessage = '';
    this.modalEl.resultKey = null;

    this.headerActionsEl.append(this.refreshButton, this.signOutButton);
    this.actionsEl.append(this.signInButton, this.backButton);
    this.headerEl.append(title, this.headerActionsEl);

    root.append(
      this.headerEl,
      this.statusEl,
      this.disclaimerEl,
      this.acknowledgeLabelEl,
      this.loadingEl,
      this.infoEl,
      this.warningEl,
      this.errorEl,
      this.actionsEl,
      this.credentialsEl,
      this.detailEl,
      this.modalEl
    );

    this.replaceChildren(root);
    this.syncUiState();
  }

  public handleHostMessage(message: HostToWebviewMessage): void {
    if (message.type === 'host/state') {
      this.clearError();
      this.environments = message.payload.environments;
      this.activeEnvironmentId = message.payload.activeEnvironmentId;
      this.authState = message.payload.signedIn ? 'logged-in' : 'logged-out';
      const activeEnv = this.environments.find((e) => e.id === this.activeEnvironmentId);
      this.detailEl.environmentType = activeEnv?.type ?? null;
      this.syncUiState();

      if (message.payload.signedIn) {
        this.loadCredentials();
      } else {
        this.clearCredentialState();
        this.detailMode = false;
      }

      return;
    }

    if (message.type === 'host/error') {
      if (message.payload.code === 'SESSION_EXPIRED') {
        this.authState = 'logged-out';
        this.clearCredentialState();
        this.syncUiState();
        return;
      }

      if (this.authState === 'logging-in' || this.authState === 'checking') {
        this.authState = 'logged-out';
      }

      if (this.authState === 'logging-out') {
        this.authState = 'logged-in';
      }

      this.errorEl.hidden = false;
      this.errorEl.textContent = message.payload.message;
      this.statusEl.textContent = this.authState === 'logged-in' ? 'Signed in.' : 'Not signed in.';
      this.credentialsEl.loading = false;
      this.detailEl.loading = false;
      this.detailEl.handleOperationError?.(message.payload.message);
      this.modalEl.loading = false;
      this.modalEl.errorMessage = message.payload.message;
      this.setKeysLoading(false);
      this.syncWarnings([]);
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
      this.credentialsEl.portalBase = message.payload.portalBase ?? '';
      this.detailEl.portalBase = message.payload.portalBase ?? '';
      this.createApiKeyUrl = toCreateApiKeyUrl(message.payload.portalBase ?? '');
      this.syncCreateApiKeyLink();
      this.setKeysLoading(false);

      if (!this.selectedCredentialId || !this.credentials.some((item) => item.id === this.selectedCredentialId)) {
        this.selectedCredentialId = this.credentials[0]?.id ?? null;
      }

      this.credentialsEl.selectedCredentialId = this.selectedCredentialId;
      this.statusEl.textContent = `Loaded ${message.payload.credentials.length} credentials.`;
      this.syncWarnings(readWarningsFromPayload(message.payload));

      if (this.detailMode && this.selectedCredentialId) {
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
      this.detailMode = true;
      this.syncUiState();
      this.statusEl.textContent = `Viewing ${message.payload.credential.name}.`;
      return;
    }

    if (message.type === 'host/key-action-result') {
      this.modalEl.loading = false;
      this.modalEl.errorMessage = '';
      this.modalEl.resultKey = message.payload.result.key ?? null;
      if (message.payload.result.action === 'revoke') {
        this.modalEl.open = false;
      }

      const actionLabel =
        message.payload.result.action === 'create'
          ? 'Generation'
          : message.payload.result.action === 'regenerate'
            ? 'Regeneration'
            : 'Revocation';
      this.statusEl.textContent = `${actionLabel} complete for slot ${message.payload.result.slot}.`;
      return;
    }

    if (message.type === 'host/user-tags') {
      this.detailEl.availableTags = message.payload.tags;
      this.credentialsEl.availableTags = message.payload.tags;
      return;
    }

    if (message.type === 'host/credential-metadata-updated') {
      const updated = message.payload.credential;
      this.selectedCredential = updated;
      this.detailEl.credential = updated;
      this.credentials = this.credentials.map((c) => (c.id === updated.id ? updated : c));
      this.credentialsEl.credentials = this.credentials;
      this.statusEl.textContent = `Updated ${updated.name}.`;
      return;
    }

    if (message.type === 'host/credential-delete-check-result') {
      this.detailEl.handleDeleteCheckResult?.(message.payload.canDelete);
      return;
    }

    if (message.type === 'host/credential-deleted') {
      const deletedId = message.payload.credentialId;
      this.credentials = this.credentials.filter((credential) => credential.id !== deletedId);
      this.credentialsEl.credentials = this.credentials;
      this.selectedCredential = null;
      this.selectedCredentialId = this.credentials[0]?.id ?? null;
      this.credentialsEl.selectedCredentialId = this.selectedCredentialId;
      this.detailEl.handleCredentialDeleted?.();
      this.detailEl.credential = null;
      this.detailMode = false;
      this.syncUiState();
      this.statusEl.textContent = 'Credential deleted.';
    }
  }

  private syncUiState(): void {
    this.syncCreateApiKeyLink();
    this.syncHeaderActions();

    const isBusy =
      this.authState === 'checking' || this.authState === 'logging-in' || this.authState === 'logging-out';

    const showSignInButton = this.authState === 'logged-out' || this.authState === 'logging-in';
    const showSignOutButton = this.authState === 'logged-in' || this.authState === 'logging-out';
    const showRefreshButton = this.authState === 'logged-in';
    const showBackButton = this.authState === 'logged-in' && this.detailMode;
    const showCreateApiKeyLink = this.authState === 'logged-in' && Boolean(this.createApiKeyUrl);

    this.setInlineControlVisibility(this.signInButton, showSignInButton);
    this.setInlineControlVisibility(this.signOutButton, showSignOutButton);
    this.setInlineControlVisibility(this.refreshButton, showRefreshButton);
    this.setInlineControlVisibility(this.backButton, showBackButton);
    this.setInlineControlVisibility(this.createApiKeyLink, showCreateApiKeyLink);

    const requiresWarningAcknowledgement =
      this.authState === 'logged-out' || this.authState === 'logging-in';
    this.signInButton.disabled =
      isBusy || (requiresWarningAcknowledgement && !this.isWarningAcknowledged());
    this.signOutButton.disabled = isBusy;
    this.refreshButton.disabled = isBusy;
    this.backButton.disabled = isBusy;
    this.createApiKeyLink.style.pointerEvents = isBusy ? 'none' : 'auto';
    this.createApiKeyLink.style.opacity = isBusy ? '0.7' : '1';
    const showWarningGate = shouldShowSignInDisclaimer(this.authState);
    this.setFlexControlVisibility(this.disclaimerEl, showWarningGate);
    this.acknowledgeLabelEl.style.display = showWarningGate ? 'flex' : 'none';

    this.syncMasterDetailVisibility();

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
    this.setKeysLoading(true);
    this.statusEl.textContent = 'Loading credentials...';
    this.post({ type: 'webview/load-credentials', payload: { refresh: true } });
  }

  private clearCredentialState(): void {
    this.credentials = [];
    this.selectedCredentialId = null;
    this.selectedCredential = null;
    this.detailMode = false;

    this.credentialsEl.credentials = [];
    this.credentialsEl.selectedCredentialId = null;
    this.credentialsEl.loading = false;
    this.credentialsEl.errorMessage = '';
    this.credentialsEl.availableTags = [];

    this.detailEl.credential = null;
    this.detailEl.loading = false;
    this.detailEl.errorMessage = '';
    this.detailEl.portalBase = '';
    this.detailEl.environmentType = null;
    this.detailEl.availableTags = [];

    this.modalEl.open = false;
    this.modalEl.loading = false;
    this.modalEl.errorMessage = '';
    this.modalEl.resultKey = null;
    this.setKeysLoading(false);
    this.syncWarnings([]);
    this.syncMasterDetailVisibility();
  }

  private post(message: WebviewToHostMessage): void {
    vscode.postMessage(serializeMessage(message));
  }

  private clearError(): void {
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }

  private syncWarnings(warnings: string[]): void {
    if (warnings.length === 0) {
      this.warningEl.hidden = true;
      this.warningEl.textContent = '';
      return;
    }

    this.warningEl.hidden = false;
    this.warningEl.textContent = warnings.join(' ');
  }

  private setKeysLoading(loading: boolean): void {
    this.loadingEl.style.display = loading ? 'flex' : 'none';
  }

  private handleExternalLinkClick(event: Event): void {
    const handledKey = '__akmExternalLinkHandled';
    if (event.defaultPrevented || Boolean((event as Event & Record<string, unknown>)[handledKey])) {
      return;
    }

    const path = event.composedPath();
    const anchor = path.find((candidate) => candidate instanceof HTMLAnchorElement);
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    const href = anchor.href?.trim();
    if (!href) {
      return;
    }

    (event as Event & Record<string, unknown>)[handledKey] = true;
    event.preventDefault();
    event.stopPropagation();
    this.post({
      type: 'webview/open-external-url',
      payload: { url: href }
    });
  }

  private syncMasterDetailVisibility(): void {
    const isLoggedIn = this.authState === 'logged-in';
    const showDetail = isLoggedIn && this.detailMode;
    this.credentialsEl.style.display = !isLoggedIn || showDetail ? 'none' : '';
    this.detailEl.style.display = showDetail ? '' : 'none';
  }

  private setInlineControlVisibility(control: HTMLElement, isVisible: boolean): void {
    control.hidden = !isVisible;
    control.style.display = isVisible ? 'inline-flex' : 'none';
  }

  private setFlexControlVisibility(control: HTMLElement, isVisible: boolean): void {
    control.hidden = !isVisible;
    control.style.display = isVisible ? 'flex' : 'none';
  }

  private syncCreateApiKeyLink(): void {
    if (!this.createApiKeyUrl) {
      this.createApiKeyLink.removeAttribute('href');
    } else {
      this.createApiKeyLink.href = this.createApiKeyUrl;
    }
  }

  private syncHeaderActions(): void {
    const showCreateApiKeyLink = this.authState === 'logged-in' && Boolean(this.createApiKeyUrl);
    if (showCreateApiKeyLink) {
      this.headerActionsEl.replaceChildren(this.createApiKeyLink, this.refreshButton, this.signOutButton);
      return;
    }

    this.headerActionsEl.replaceChildren(this.refreshButton, this.signOutButton);
  }

  private isWarningAcknowledged(): boolean {
    return this.acknowledgeCheckboxEl.checked;
  }
}

type UiIconName =
  | 'alert-triangle'
  | 'arrow-left'
  | 'external-link'
  | 'rotate-ccw'
  | 'user'
  | 'arrow-right-from-bracket';
type IconPosition = 'start' | 'end';

function withIconLabel(
  label: string,
  iconName?: UiIconName,
  iconPosition: IconPosition = 'start'
): string {
  if (!iconName) {
    return label;
  }

  const icon = `<akm-icon name="${iconName}" size="12"></akm-icon>`;
  return iconPosition === 'start' ? `${icon}<span>${label}</span>` : `<span>${label}</span>${icon}`;
}

function setupButton(
  button: HTMLButtonElement,
  label: string,
  iconName?: UiIconName,
  iconPosition: IconPosition = 'start'
): void {
  button.type = 'button';
  button.innerHTML = withIconLabel(label, iconName, iconPosition);
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.gap = '6px';
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

function setupPrimaryLink(
  link: HTMLAnchorElement,
  label: string,
  iconName?: UiIconName,
  iconPosition: IconPosition = 'start'
): void {
  link.innerHTML = withIconLabel(label, iconName, iconPosition);
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';
  link.style.gap = '6px';
  link.style.width = 'max-content';
  link.style.border = '1px solid var(--vscode-button-background, #0b63ce)';
  link.style.borderRadius = '0';
  link.style.boxSizing = 'border-box';
  link.style.height = '33px';
  link.style.padding = '0 9px';
  link.style.lineHeight = '1';
  link.style.fontSize = '12px';
  link.style.fontFamily = "var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif)";
  link.style.background = 'var(--vscode-button-background, #0b63ce)';
  link.style.cursor = 'pointer';
  link.style.color = 'var(--vscode-button-foreground, #ffffff)';
  link.style.textDecoration = 'none';
}

function toCreateApiKeyUrl(portalBase: string): string | null {
  if (!portalBase) {
    return null;
  }

  try {
    const hostname = new URL(portalBase).hostname;
    const isOnlineHost = hostname.endsWith('.maps.arcgis.com') || hostname.endsWith('.mapsdevext.arcgis.com');
    if (!isOnlineHost) {
      return null;
    }

    const [urlKey] = hostname.split('.');
    if (!urlKey) {
      return null;
    }

    return `https://${urlKey}.maps.arcgis.com/home/content.html?&newItem=developerCredentials#my`;
  } catch {
    return null;
  }
}

function readWarningsFromPayload(payload: unknown): string[] {
  if (typeof payload !== 'object' || payload === null || !('warnings' in payload)) {
    return [];
  }

  const warnings = (payload as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings.filter((warning): warning is string => typeof warning === 'string');
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
