import {
  deserializeMessage,
  serializeMessage,
  type ApiKeyCredential,
  type EnvironmentConfig,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from '@arcgis-api-keys/core';
import '@arcgis-api-keys/core/components';
import { CHROME_MESSAGE_SCOPE, isChromePushMessage, isHostMessage } from './runtime-types.js';

interface CredentialListElement extends HTMLElement {
  credentials: ApiKeyCredential[];
  selectedCredentialId: string | null;
  loading: boolean;
  errorMessage: string;
  portalBase: string;
  availableTags: string[];
}

interface CredentialDetailElement extends HTMLElement {
  credential: ApiKeyCredential | null;
  loading: boolean;
  errorMessage: string;
  portalBase: string;
  environmentType: EnvironmentConfig['type'] | null;
  availableTags: string[];
  handleDeleteCheckResult?: (canDelete: boolean) => void;
  handleCredentialDeleted?: () => void;
  handleOperationError?: (message: string) => void;
}

interface KeyActionModalElement extends HTMLElement {
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
}

type AuthState = 'checking' | 'logged-out' | 'logging-in' | 'logged-in' | 'logging-out';

class ArcgisApiKeysAppElement extends HTMLElement {
  private readonly statusEl = document.createElement('p');
  private readonly disclaimerEl = document.createElement('p');
  private readonly loadingEl = document.createElement('div');
  private readonly infoEl = document.createElement('p');
  private readonly warningEl = document.createElement('p');
  private readonly errorEl = document.createElement('p');
  private readonly headerEl = document.createElement('div');
  private readonly headerActionsEl = document.createElement('div');
  private readonly actionsEl = document.createElement('div');
  private readonly createApiKeyLink = document.createElement('a');
  private readonly environmentSelectEl = document.createElement('select');
  private readonly acknowledgeLabelEl = document.createElement('label');
  private readonly acknowledgeCheckboxEl = document.createElement('input');
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
    this.bindMessageListener();
    void this.requestAndHandle({ type: 'webview/initialize', payload: {} });
  }

  private render(): void {
    const root = document.createElement('div');
    root.style.fontFamily = "'Avenir Next', 'Segoe UI', sans-serif";
    root.style.padding = '14px';
    root.style.display = 'grid';
    root.style.gap = '10px';

    const title = document.createElement('h2');
    title.textContent = 'ArcGIS API Keys Explorer';
    title.style.margin = '0';
    title.style.fontSize = '20px';

    this.headerEl.style.display = 'flex';
    this.headerEl.style.alignItems = 'center';
    this.headerEl.style.justifyContent = 'space-between';
    this.headerEl.style.gap = '10px';
    this.headerEl.style.flexWrap = 'wrap';

    this.headerActionsEl.style.display = 'flex';
    this.headerActionsEl.style.alignItems = 'center';
    this.headerActionsEl.style.gap = '8px';
    this.headerActionsEl.style.flexWrap = 'wrap';

    this.statusEl.style.margin = '0';
    this.statusEl.style.fontSize = '13px';

    this.disclaimerEl.style.margin = '0';
    this.disclaimerEl.style.padding = '8px';
    this.disclaimerEl.style.borderLeft = '3px solid #d97706';
    this.disclaimerEl.style.fontSize = '12px';
    this.disclaimerEl.style.lineHeight = '1.4';
    this.disclaimerEl.innerHTML =
      '⚠️ This is an open source side project made for fun. It is not an official Esri project, so use it at your own risk. It is maintained by the community. For bugs or ideas, use <a href="https://github.com/hhkaos/arcgis-api-key-manager-toolkit/issues" target="_blank" rel="noopener noreferrer">https://github.com/hhkaos/arcgis-api-key-manager-toolkit/issues</a>.';

    this.loadingEl.style.display = 'none';
    this.loadingEl.style.alignItems = 'center';
    this.loadingEl.style.gap = '8px';
    this.loadingEl.style.fontSize = '12px';
    this.loadingEl.style.color = '#425466';
    this.loadingEl.innerHTML = '<progress style="width: 120px;"></progress><span>Loading API keys...</span>';

    this.infoEl.textContent = 'Chrome host wiring is active. UI components are shared from packages/core.';
    this.infoEl.style.margin = '0';
    this.infoEl.style.fontSize = '12px';
    this.infoEl.style.color = '#425466';

    this.warningEl.style.margin = '0';
    this.warningEl.style.color = '#8a4b00';
    this.warningEl.style.fontSize = '12px';
    this.warningEl.style.fontWeight = '600';
    this.warningEl.hidden = true;

    this.errorEl.style.margin = '0';
    this.errorEl.style.color = '#b42318';
    this.errorEl.style.fontWeight = '600';
    this.errorEl.style.fontSize = '12px';
    this.errorEl.hidden = true;

    this.actionsEl.style.display = 'flex';
    this.actionsEl.style.alignItems = 'center';
    this.actionsEl.style.gap = '8px';
    this.actionsEl.style.flexWrap = 'wrap';

    this.acknowledgeLabelEl.style.display = 'flex';
    this.acknowledgeLabelEl.style.alignItems = 'flex-start';
    this.acknowledgeLabelEl.style.gap = '6px';
    this.acknowledgeLabelEl.style.fontSize = '12px';
    this.acknowledgeLabelEl.style.lineHeight = '1.35';
    this.acknowledgeLabelEl.style.cursor = 'pointer';

    this.acknowledgeCheckboxEl.type = 'checkbox';
    this.acknowledgeCheckboxEl.style.margin = '2px 0 0 0';
    this.acknowledgeCheckboxEl.addEventListener('change', () => this.syncUiState());

    const acknowledgeTextEl = document.createElement('span');
    acknowledgeTextEl.textContent =
      'I have read the warning message above and I understand I want to proceed.';
    this.acknowledgeLabelEl.replaceChildren(this.acknowledgeCheckboxEl, acknowledgeTextEl);

    setupPrimaryLink(this.createApiKeyLink, 'Create API key ↗');
    this.environmentSelectEl.style.minWidth = '260px';
    this.environmentSelectEl.addEventListener('change', () => {
      const environmentId = this.environmentSelectEl.value;
      if (!environmentId) {
        return;
      }

      void this.requestAndHandle({
        type: 'webview/select-environment',
        payload: { environmentId }
      });
    });

    setupButton(this.signInButton, 'Sign in with ArcGIS');
    setupButton(this.signOutButton, 'Sign out');
    setupButton(this.refreshButton, 'Refresh Credentials');
    setupButton(this.backButton, '← Back to List');
    this.backButton.style.background = '#0b63ce';
    this.backButton.style.color = '#ffffff';
    this.backButton.style.borderColor = '#0b63ce';
    this.backButton.style.fontWeight = '700';
    this.signInButton.addEventListener('click', () => {
      this.clearError();
      this.authState = 'logging-in';
      this.syncUiState();
      void this.requestAndHandle({ type: 'webview/sign-in', payload: {} });
    });

    this.signOutButton.addEventListener('click', () => {
      this.clearError();
      this.authState = 'logging-out';
      this.syncUiState();
      void this.requestAndHandle({ type: 'webview/sign-out', payload: {} });
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

      void this.requestAndHandle({
        type: 'webview/load-credential-detail',
        payload: { credentialId: detail.credentialId }
      });
    });

    this.credentialsEl.addEventListener('fetch-user-tags', () => {
      void this.requestAndHandle({ type: 'webview/fetch-user-tags', payload: {} });
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

      void this.requestAndHandle({
        type: 'webview/update-credential-metadata',
        payload: {
          credentialId: detail.credentialId,
          title: detail.title,
          snippet: detail.snippet,
          tags: detail.tags
        }
      });
    });

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
      void this.requestAndHandle({ type: 'webview/fetch-user-tags', payload: {} });
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

      void this.requestAndHandle({
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

      void this.requestAndHandle({
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

      void this.requestAndHandle({
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

      void this.requestAndHandle({
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

      void this.requestAndHandle({
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

      void this.requestAndHandle({
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
      void this.requestAndHandle({
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

    this.headerActionsEl.append(this.createApiKeyLink, this.refreshButton, this.signOutButton);
    this.actionsEl.append(this.environmentSelectEl, this.signInButton, this.backButton);
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

  private bindMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (!isChromePushMessage(message)) {
        return;
      }

      const hostMessage = deserializeHostMessage(message.payload.message);
      if (hostMessage) {
        this.handleHostMessage(hostMessage);
      }
    });
  }

  private async requestAndHandle(message: WebviewToHostMessage): Promise<void> {
    const hostMessage = await requestHostMessage(message);
    this.handleHostMessage(hostMessage);
  }

  private handleHostMessage(message: HostToWebviewMessage): void {
    if (message.type === 'host/state') {
      this.clearError();
      this.environments = message.payload.environments;
      this.activeEnvironmentId = message.payload.activeEnvironmentId;
      this.syncEnvironmentOptions();
      const activeEnv = this.environments.find((e) => e.id === this.activeEnvironmentId);
      this.detailEl.environmentType = activeEnv?.type ?? null;

      this.authState = message.payload.signedIn ? 'logged-in' : 'logged-out';
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
      if (this.authState === 'logging-in' || this.authState === 'checking') {
        this.authState = 'logged-out';
      }

      if (this.authState === 'logging-out') {
        this.authState = 'logged-in';
      }

      const suffix = message.payload.code ? ` (${message.payload.code})` : '';
      this.errorEl.hidden = false;
      this.errorEl.textContent = `${message.payload.message}${suffix}`;
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
        void this.requestAndHandle({
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

    if (message.type === 'host/credential-metadata-updated') {
      const updated = message.payload.credential;
      this.selectedCredential = updated;
      this.detailEl.credential = updated;
      this.credentials = this.credentials.map((credential) =>
        credential.id === updated.id ? updated : credential
      );
      this.credentialsEl.credentials = this.credentials;
      this.statusEl.textContent = `Updated ${updated.name}.`;
      this.syncUiState();
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
      this.statusEl.textContent = 'Credential deleted.';
      this.syncUiState();
      this.loadCredentials();
      return;
    }

    if (message.type === 'host/user-tags') {
      this.detailEl.availableTags = message.payload.tags;
      this.credentialsEl.availableTags = message.payload.tags;
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
      this.syncUiState();
      this.loadCredentials();
      if (this.selectedCredentialId) {
        void this.requestAndHandle({
          type: 'webview/load-credential-detail',
          payload: { credentialId: this.selectedCredentialId }
        });
      }
    }
  }

  private syncEnvironmentOptions(): void {
    const current = this.activeEnvironmentId ?? '';

    this.environmentSelectEl.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = this.environments.length > 0 ? 'Select environment' : 'No environments';
    this.environmentSelectEl.append(placeholder);

    for (const environment of this.environments) {
      const option = document.createElement('option');
      option.value = environment.id;
      option.textContent = environment.name;
      this.environmentSelectEl.append(option);
    }

    this.environmentSelectEl.value = current;
  }

  private syncUiState(): void {
    this.syncCreateApiKeyLink();

    const isBusy =
      this.authState === 'checking' || this.authState === 'logging-in' || this.authState === 'logging-out';

    this.signInButton.hidden = !(this.authState === 'logged-out' || this.authState === 'logging-in');
    this.signOutButton.hidden = !(this.authState === 'logged-in' || this.authState === 'logging-out');
    this.refreshButton.hidden = this.authState !== 'logged-in';
    this.backButton.hidden = this.authState !== 'logged-in' || !this.detailMode;
    this.createApiKeyLink.hidden = this.authState !== 'logged-in' || !this.createApiKeyUrl;

    const requiresAcknowledgement = !this.signInButton.hidden;
    this.signInButton.disabled = isBusy || (requiresAcknowledgement && !this.acknowledgeCheckboxEl.checked);
    this.signOutButton.disabled = isBusy;
    this.refreshButton.disabled = isBusy;
    this.backButton.disabled = isBusy;
    this.createApiKeyLink.style.pointerEvents = isBusy ? 'none' : 'auto';
    this.createApiKeyLink.style.opacity = isBusy ? '0.7' : '1';
    this.disclaimerEl.hidden = this.signInButton.hidden;
    this.acknowledgeLabelEl.hidden = this.disclaimerEl.hidden;

    this.credentialsEl.hidden = this.authState !== 'logged-in' || this.detailMode;
    this.detailEl.hidden = this.authState !== 'logged-in' || !this.detailMode;
    this.syncMasterDetailVisibility();

    if (this.authState === 'checking') {
      this.statusEl.textContent = 'Checking sign-in status...';
    } else if (this.authState === 'logged-out') {
      this.statusEl.textContent = this.environments.length > 0 ? 'Not signed in.' : 'No environment configured.';
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
    void this.requestAndHandle({ type: 'webview/load-credentials', payload: { refresh: true } });
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
    this.createApiKeyUrl = null;
    this.syncCreateApiKeyLink();

    this.modalEl.open = false;
    this.modalEl.loading = false;
    this.modalEl.errorMessage = '';
    this.modalEl.resultKey = null;
    this.setKeysLoading(false);
    this.syncWarnings([]);
    this.syncMasterDetailVisibility();
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

  private syncMasterDetailVisibility(): void {
    const isLoggedIn = this.authState === 'logged-in';
    const showDetail = isLoggedIn && this.detailMode;
    this.credentialsEl.style.display = showDetail ? 'none' : '';
    this.detailEl.style.display = showDetail ? '' : 'none';
  }

  private syncCreateApiKeyLink(): void {
    if (!this.createApiKeyUrl) {
      this.createApiKeyLink.removeAttribute('href');
    } else {
      this.createApiKeyLink.href = this.createApiKeyUrl;
      this.createApiKeyLink.target = '_blank';
      this.createApiKeyLink.rel = 'noopener noreferrer';
    }

  }
}

async function requestHostMessage(message: WebviewToHostMessage): Promise<HostToWebviewMessage> {
  try {
    const response = (await chrome.runtime.sendMessage({
      scope: CHROME_MESSAGE_SCOPE,
      type: 'explorer/webview-message',
      payload: { message: serializeMessage(message) }
    })) as { ok?: boolean; hostMessage?: string; error?: string };

    if (!response?.ok) {
      return {
        type: 'host/error',
        payload: {
          message: response?.error ?? 'Service worker request failed.',
          recoverable: true
        }
      };
    }

    return deserializeHostMessage(response.hostMessage) ?? {
      type: 'host/error',
      payload: {
        message: 'Service worker returned an invalid response.',
        recoverable: true
      }
    };
  } catch (error) {
    return {
      type: 'host/error',
      payload: {
        message: error instanceof Error ? error.message : 'Failed to communicate with service worker.',
        recoverable: true
      }
    };
  }
}

function deserializeHostMessage(raw: unknown): HostToWebviewMessage | null {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    const parsed = deserializeMessage(raw);
    if (!isHostMessage(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setupButton(button: HTMLButtonElement, label: string): void {
  button.type = 'button';
  button.textContent = label;
  button.style.width = 'max-content';
  button.style.border = '1px solid #7f95aa';
  button.style.borderRadius = '0';
  button.style.padding = '7px 9px';
  button.style.minHeight = '33px';
  button.style.fontSize = '12px';
  button.style.fontFamily = "'Avenir Next', 'Segoe UI', sans-serif";
  button.style.background = '#ffffff';
  button.style.cursor = 'pointer';
  button.style.color = '#142331';
}

function setupPrimaryLink(link: HTMLAnchorElement, label: string): void {
  link.textContent = label;
  link.style.display = 'inline-flex';
  link.style.alignItems = 'center';
  link.style.width = 'max-content';
  link.style.border = '1px solid #0b63ce';
  link.style.borderRadius = '0';
  link.style.boxSizing = 'border-box';
  link.style.height = '33px';
  link.style.padding = '0 9px';
  link.style.lineHeight = '1';
  link.style.fontSize = '12px';
  link.style.fontFamily = "'Avenir Next', 'Segoe UI', sans-serif";
  link.style.background = '#0b63ce';
  link.style.cursor = 'pointer';
  link.style.color = '#ffffff';
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
