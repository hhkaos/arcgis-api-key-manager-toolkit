import {
  ArcGisRestClientImpl,
  type ArcGisRestRequest,
  type ArcGisRestTransport,
  EnvironmentManager,
  type ArcGisPagedCredentialsResponse,
  FetchArcGisRestTransport,
  mapRestError,
  type RestClientError,
  type EnvironmentConfig,
  type EnvironmentType,
  type WebviewToHostMessage
} from '@arcgis-api-keys/core';
import * as vscode from 'vscode';
import { VscodeAuthAdapter } from './adapters/vscode-auth-adapter.js';
import { VscodeClipboardAdapter } from './adapters/vscode-clipboard-adapter.js';
import { VscodeStorageAdapter } from './adapters/vscode-storage-adapter.js';
import { buildCredentialLoadMessage } from './flows/credential-loader.js';
import { AccountWebviewPanelProvider, type WebviewMessageContext } from './webview/panel-provider.js';

interface CategoryNode {
  kind: EnvironmentType;
  label: string;
}

interface AccountNode {
  environment: EnvironmentConfig;
  signedIn: boolean;
}

type ExplorerNode = CategoryNode | AccountNode;

const VIEW_ID = 'arcgisApiKeys';
const VERBOSE_HTTP_LOG_CONFIG = 'arcgisApiKeys.debug.verboseHttpLogging';

const CATEGORIES: CategoryNode[] = [
  { kind: 'online', label: 'ArcGIS Online' },
  { kind: 'location-platform', label: 'ArcGIS Location Platform' },
  { kind: 'enterprise', label: 'ArcGIS Enterprise' }
];

class ArcGisApiKeysTreeProvider implements vscode.TreeDataProvider<ExplorerNode> {
  private readonly manager: EnvironmentManager;
  private readonly storage: VscodeStorageAdapter;
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ExplorerNode | undefined>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(manager: EnvironmentManager, storage: VscodeStorageAdapter) {
    this.manager = manager;
    this.storage = storage;
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  public getTreeItem(element: ExplorerNode): vscode.TreeItem {
    if (isCategoryNode(element)) {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'category';
      return item;
    }

    const item = new vscode.TreeItem(element.environment.name, vscode.TreeItemCollapsibleState.None);
    item.id = element.environment.id;
    item.contextValue = 'account';
    item.description = element.signedIn ? 'Signed in' : 'Not signed in';
    item.tooltip = element.environment.portalUrl
      ? `${element.environment.name} (${element.environment.portalUrl})`
      : element.environment.name;
    item.iconPath = new vscode.ThemeIcon(element.signedIn ? 'account' : 'circle-slash');
    item.command = {
      command: 'arcgis-api-keys.openAccount',
      title: 'Open Account',
      arguments: [element]
    };

    return item;
  }

  public async getChildren(element?: ExplorerNode): Promise<ExplorerNode[]> {
    if (!element) {
      return CATEGORIES;
    }

    if (!isCategoryNode(element)) {
      return [];
    }

    const grouped = this.manager.listEnvironments();
    const environments = grouped[element.kind] ?? [];

    const children: AccountNode[] = [];
    for (const environment of environments) {
      const token = await this.storage.getToken(environment.id);
      const signedIn = Boolean(token && token.expiresAt > Date.now());
      children.push({ environment, signedIn });
    }

    return children;
  }
}

function isCategoryNode(value: ExplorerNode): value is CategoryNode {
  return 'kind' in value;
}

function isAccountNode(value: unknown): value is AccountNode {
  return typeof value === 'object' && value !== null && 'environment' in value;
}

interface ExtensionServices {
  manager: EnvironmentManager;
  storage: VscodeStorageAdapter;
  authAdapter: VscodeAuthAdapter;
  treeProvider: ArcGisApiKeysTreeProvider;
  webviewPanels: AccountWebviewPanelProvider;
  restClient: ArcGisRestClientImpl;
  transport: ArcGisRestTransport;
}

function registerCommands(context: vscode.ExtensionContext, services: ExtensionServices): void {
  const register = (command: string, callback: (...args: unknown[]) => unknown): void => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  register('arcgis-api-keys.addEnvironment', async () => {
    const type = await promptEnvironmentType();
    if (!type) {
      return;
    }

    const name = await vscode.window.showInputBox({
      prompt: 'Environment display name',
      placeHolder: type === 'online' ? 'ArcGIS Online (Dev)' : 'My ArcGIS Environment',
      validateInput: (value) => (value.trim() ? null : 'Name is required.')
    });
    if (!name) {
      return;
    }

    const clientId = await vscode.window.showInputBox({
      prompt: 'ArcGIS OAuth client ID',
      placeHolder: 'Enter ArcGIS application client ID',
      validateInput: (value) => (value.trim() ? null : 'Client ID is required.')
    });
    if (!clientId) {
      return;
    }

    let portalUrl: string | undefined;
    if (type === 'enterprise') {
      const rawPortalUrl = await vscode.window.showInputBox({
        prompt: 'ArcGIS Enterprise portal URL',
        placeHolder: 'https://gis.example.com/portal',
        validateInput: (value) =>
          /^https?:\/\/.+/.test(value.trim()) ? null : 'Portal URL must start with http:// or https://'
      });
      if (!rawPortalUrl) {
        return;
      }

      portalUrl = rawPortalUrl.trim();
    }

    const environment: EnvironmentConfig = {
      id: `${type}-${Date.now()}`,
      name: name.trim(),
      type,
      clientId: clientId.trim(),
      portalUrl
    };

    await services.manager.addEnvironment(environment);
    if (!services.manager.getActiveEnvironment()) {
      await services.manager.setActiveEnvironment(environment.id);
    }

    services.treeProvider.refresh();
    await vscode.window.showInformationMessage(`Added environment: ${environment.name}`);
  });

  register('arcgis-api-keys.removeEnvironment', async (node?: AccountNode) => {
    const selected = isAccountNode(node) ? node.environment : await pickEnvironment(services.manager);
    if (!selected) {
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Remove environment \"${selected.name}\"?`,
      { modal: true },
      'Remove'
    );

    if (confirmed !== 'Remove') {
      return;
    }

    await services.manager.removeEnvironment(selected.id);
    services.treeProvider.refresh();
  });

  register('arcgis-api-keys.signIn', async (node?: AccountNode) => {
    const selected = isAccountNode(node) ? node.environment : await pickEnvironment(services.manager);
    if (!selected) {
      return;
    }

    await signInEnvironment(services, selected);
  });

  register('arcgis-api-keys.signOut', async (node?: AccountNode) => {
    const selected = isAccountNode(node) ? node.environment : await pickEnvironment(services.manager);
    if (!selected) {
      return;
    }

    await signOutEnvironment(services, selected);
  });

  register('arcgis-api-keys.refresh', () => {
    services.treeProvider.refresh();
  });

  register('arcgis-api-keys.debugCredentialProbe', async () => {
    const selected = await pickEnvironment(services.manager);
    if (!selected) {
      return;
    }

    const token = await services.storage.getToken(selected.id);
    if (!token) {
      await vscode.window.showWarningMessage('No token found. Sign in first.');
      return;
    }

    const probe = await probeCredentialEndpoints(services, selected, token.accessToken);
    await vscode.window.showInformationMessage(
      `Probe ${selected.name}: apiKeys=${probe.apiKeysSummary}; apiTokens=${probe.apiTokensSummary}`
    );
  });

  register('arcgis-api-keys.openAccount', async (node?: AccountNode) => {
    if (!isAccountNode(node)) {
      return;
    }

    await services.manager.setActiveEnvironment(node.environment.id);
    services.webviewPanels.open(node.environment);
    await postCurrentStateToPanel(services, node.environment);
  });
}

async function promptEnvironmentType(): Promise<EnvironmentType | undefined> {
  const selected = await vscode.window.showQuickPick(
    [
      { label: 'ArcGIS Online', value: 'online' as const },
      { label: 'ArcGIS Location Platform', value: 'location-platform' as const },
      { label: 'ArcGIS Enterprise', value: 'enterprise' as const }
    ],
    {
      title: 'Select ArcGIS environment type'
    }
  );

  return selected?.value;
}

async function pickEnvironment(manager: EnvironmentManager): Promise<EnvironmentConfig | undefined> {
  const grouped = manager.listEnvironments();
  const environments = [...grouped.online, ...grouped['location-platform'], ...grouped.enterprise];

  if (environments.length === 0) {
    await vscode.window.showInformationMessage('No environments configured yet.');
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    environments.map((environment) => ({
      label: environment.name,
      description: environment.type,
      detail: environment.portalUrl,
      environment
    })),
    {
      title: 'Select environment'
    }
  );

  return selected?.environment;
}

async function signInEnvironment(services: ExtensionServices, environment: EnvironmentConfig): Promise<void> {
  const token = await services.authAdapter.signIn(environment);
  await services.storage.setToken(environment.id, token);
  await services.manager.setActiveEnvironment(environment.id);

  services.treeProvider.refresh();
  await postCurrentStateToPanel(services, environment);
  await vscode.window.showInformationMessage(`Signed in to ${environment.name}.`);
}

async function signOutEnvironment(services: ExtensionServices, environment: EnvironmentConfig): Promise<void> {
  await services.authAdapter.signOut(environment);
  await services.storage.clearToken(environment.id);

  services.treeProvider.refresh();
  await postCurrentStateToPanel(services, environment);
  await vscode.window.showInformationMessage(`Signed out from ${environment.name}.`);
}

async function postCurrentStateToPanel(
  services: ExtensionServices,
  environment: EnvironmentConfig
): Promise<void> {
  const token = await services.storage.getToken(environment.id);
  const signedIn = Boolean(token && token.expiresAt > Date.now());

  services.webviewPanels.postToEnvironment(environment.id, {
    type: 'host/state',
    payload: {
      environments: [environment],
      activeEnvironmentId: environment.id,
      signedIn
    }
  });
}

async function handleWebviewMessage(
  services: ExtensionServices,
  context: WebviewMessageContext
): Promise<void> {
  const { environment, panel, message } = context;

  switch (message.type) {
    case 'webview/initialize':
      await postCurrentStateToPanel(services, environment);
      break;
    case 'webview/sign-in':
      await signInEnvironment(services, environment);
      break;
    case 'webview/sign-out':
      await signOutEnvironment(services, environment);
      break;
    case 'webview/load-credentials':
      await loadCredentialsForEnvironment(services, environment, panel);
      break;
    case 'webview/load-credential-detail':
      await loadCredentialDetailForEnvironment(
        services,
        environment,
        panel,
        message.payload.credentialId
      );
      break;
    case 'webview/key-action':
      await executeKeyActionForEnvironment(services, environment, panel, message.payload);
      break;
    default:
      await handleUnsupportedWebviewMessage(panel, message);
      break;
  }
}

async function probeCredentialEndpoints(
  services: ExtensionServices,
  environment: EnvironmentConfig,
  accessToken: string
): Promise<{ apiKeysSummary: string; apiTokensSummary: string }> {
  const apiKeysSummary = await probeEndpoint(
    services,
    environment,
    accessToken,
    '/portals/self/apiKeys'
  );
  const apiTokensSummary = await probeEndpoint(
    services,
    environment,
    accessToken,
    '/portals/self/apiTokens'
  );

  return { apiKeysSummary, apiTokensSummary };
}

async function probeEndpoint(
  services: ExtensionServices,
  environment: EnvironmentConfig,
  accessToken: string,
  path: '/portals/self/apiKeys' | '/portals/self/apiTokens'
): Promise<string> {
  try {
    const response = await services.transport.request<ArcGisPagedCredentialsResponse>({
      path,
      method: 'GET',
      environment,
      accessToken,
      query: {
        start: 1,
        num: 1,
        f: 'json'
      }
    });

    const keys = Object.keys(response).slice(0, 8).join(',');
    const firstRaw =
      firstArrayItem(response.apiKeys) ??
      firstArrayItem(response.credentials) ??
      firstArrayItem(response.apiKeyCredentials) ??
      firstArrayItem(response.apiTokens) ??
      firstArrayItem(response.items);
    const firstType = describeValue(firstRaw);
    const firstKeys = isRecord(firstRaw) ? Object.keys(firstRaw).slice(0, 8).join(',') : 'none';
    const count =
      readArrayCount(response.credentials) ??
      readArrayCount(response.apiKeys) ??
      readArrayCount(response.apiKeyCredentials) ??
      readArrayCount(response.apiTokens) ??
      readArrayCount(response.items) ??
      0;

    return `ok(count=${count};keys=${keys || 'none'};firstType=${firstType};firstKeys=${firstKeys})`;
  } catch (error) {
    const mapped = mapRestError(error);
    return `error(${mapped.code})`;
  }
}

function firstArrayItem(value: unknown): unknown {
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

function readArrayCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function loadCredentialsForEnvironment(
  services: ExtensionServices,
  environment: EnvironmentConfig,
  panel: vscode.WebviewPanel
): Promise<void> {
  const token = await services.storage.getToken(environment.id);

  const message = await buildCredentialLoadMessage({
    token,
    fetchCredentials: (accessToken) =>
      services.restClient.fetchCredentials({
        environment,
        accessToken
      }),
    fetchWarnings: () => services.restClient.getLastResponseValidationWarnings()
  });

  services.webviewPanels.post(panel, message);
}

async function loadCredentialDetailForEnvironment(
  services: ExtensionServices,
  environment: EnvironmentConfig,
  panel: vscode.WebviewPanel,
  credentialId: string
): Promise<void> {
  const token = await getValidAccessToken(services, environment, panel);
  if (!token) {
    return;
  }

  try {
    const credential = await services.restClient.fetchCredentialDetail({
      environment,
      accessToken: token,
      credentialId
    });

    services.webviewPanels.post(panel, {
      type: 'host/credential-detail',
      payload: { credential }
    });
  } catch (error) {
    const mapped = normalizeRestError(error);
    services.webviewPanels.post(panel, {
      type: 'host/error',
      payload: {
        message: mapped.message,
        code: mapped.code,
        recoverable: mapped.recoverable
      }
    });
  }
}

async function executeKeyActionForEnvironment(
  services: ExtensionServices,
  environment: EnvironmentConfig,
  panel: vscode.WebviewPanel,
  payload: {
    credentialId: string;
    slot: 1 | 2;
    action: 'create' | 'regenerate';
    expirationDays?: number;
  }
): Promise<void> {
  const token = await getValidAccessToken(services, environment, panel);
  if (!token) {
    return;
  }

  try {
    const result =
      payload.action === 'create'
        ? await services.restClient.createApiKey({
            environment,
            accessToken: token,
            credentialId: payload.credentialId,
            slot: payload.slot,
            expirationDays: payload.expirationDays
          })
        : await services.restClient.regenerateApiKey({
            environment,
            accessToken: token,
            credentialId: payload.credentialId,
            slot: payload.slot,
            expirationDays: payload.expirationDays
          });

    services.webviewPanels.post(panel, {
      type: 'host/key-action-result',
      payload: { result }
    });

    await loadCredentialsForEnvironment(services, environment, panel);
    await loadCredentialDetailForEnvironment(services, environment, panel, payload.credentialId);
  } catch (error) {
    const mapped = normalizeRestError(error);
    services.webviewPanels.post(panel, {
      type: 'host/error',
      payload: {
        message: mapped.message,
        code: mapped.code,
        recoverable: mapped.recoverable
      }
    });
  }
}

async function getValidAccessToken(
  services: ExtensionServices,
  environment: EnvironmentConfig,
  panel: vscode.WebviewPanel
): Promise<string | null> {
  const token = await services.storage.getToken(environment.id);
  if (!token) {
    services.webviewPanels.post(panel, {
      type: 'host/error',
      payload: {
        message: 'Not signed in. Sign in to continue.',
        code: 'SESSION_EXPIRED',
        recoverable: true
      }
    });
    return null;
  }

  if (token.expiresAt <= Date.now()) {
    services.webviewPanels.post(panel, {
      type: 'host/error',
      payload: {
        message: 'Session expired. Sign in again to continue.',
        code: 'SESSION_EXPIRED',
        recoverable: true
      }
    });
    return null;
  }

  return token.accessToken;
}

function normalizeRestError(error: unknown): RestClientError {
  if (isRestClientError(error)) {
    return error;
  }

  return mapRestError(error);
}

function isRestClientError(value: unknown): value is RestClientError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'recoverable' in value
  );
}

async function handleUnsupportedWebviewMessage(
  panel: vscode.WebviewPanel,
  message: WebviewToHostMessage
): Promise<void> {
  if (message.type.startsWith('webview/')) {
    void panel.webview.postMessage(
      JSON.stringify({
        type: 'host/error',
        payload: {
          message: `Message not wired yet: ${message.type}`,
          recoverable: true
        }
      })
    );
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('ArcGIS API Key Explorer');
  context.subscriptions.push(output);

  const storage = new VscodeStorageAdapter(context);
  const manager = new EnvironmentManager(storage);
  await manager.load();

  const authAdapter = new VscodeAuthAdapter(context);
  const clipboardAdapter = new VscodeClipboardAdapter();
  const transport = new LoggingTransport(new FetchArcGisRestTransport(), output, () =>
    vscode.workspace.getConfiguration().get<boolean>(VERBOSE_HTTP_LOG_CONFIG, false)
  );
  const restClient = new ArcGisRestClientImpl(transport);

  context.subscriptions.push(vscode.window.registerUriHandler(authAdapter));

  const treeProvider = new ArcGisApiKeysTreeProvider(manager, storage);
  const webviewPanels = new AccountWebviewPanelProvider(context.extensionUri, async (webviewContext) => {
    await handleWebviewMessage(
      {
        manager,
        storage,
        authAdapter,
        treeProvider,
        webviewPanels,
        restClient,
        transport
      },
      webviewContext
    );
  });

  const treeView = vscode.window.createTreeView(VIEW_ID, {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  registerCommands(context, {
    manager,
    storage,
    authAdapter,
    treeProvider,
    webviewPanels,
    restClient,
    transport
  });

  void clipboardAdapter;
}

export function deactivate(): void {
  // No-op for now.
}

class LoggingTransport implements ArcGisRestTransport {
  private readonly inner: ArcGisRestTransport;
  private readonly output: vscode.OutputChannel;
  private readonly isVerboseEnabled: () => boolean;

  public constructor(
    inner: ArcGisRestTransport,
    output: vscode.OutputChannel,
    isVerboseEnabled: () => boolean
  ) {
    this.inner = inner;
    this.output = output;
    this.isVerboseEnabled = isVerboseEnabled;
  }

  public async request<TResponse>(request: ArcGisRestRequest): Promise<TResponse> {
    const startedAt = Date.now();
    this.output.appendLine(
      `[request] ${request.method} ${request.path} env=${request.environment.type}:${request.environment.id}`
    );

    if (this.isVerboseEnabled()) {
      this.output.appendLine(
        `[request:verbose] ${safeStringify({
          method: request.method,
          path: request.path,
          environment: {
            id: request.environment.id,
            type: request.environment.type
          },
          query: redactSensitive(request.query ?? {}),
          body: redactSensitive(request.body ?? {})
        })}`
      );
    }

    try {
      const response = await this.inner.request<TResponse>(request);
      const duration = Date.now() - startedAt;
      this.output.appendLine(
        `[response] ${request.method} ${request.path} ok (${duration}ms)`
      );

      if (this.isVerboseEnabled()) {
        this.output.appendLine(
          `[response:verbose] ${request.method} ${request.path} ${safeStringify(
            redactSensitive(response)
          )}`
        );
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startedAt;
      const mapped = mapRestError(error);
      this.output.appendLine(
        `[response] ${request.method} ${request.path} error=${mapped.code} (${duration}ms)`
      );

      if (this.isVerboseEnabled()) {
        this.output.appendLine(
          `[response:verbose] ${request.method} ${request.path} error-payload=${safeStringify(
            redactSensitive(error)
          )}`
        );
      }

      throw error;
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, innerValue] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
      continue;
    }

    result[key] = redactSensitive(innerValue);
  }

  return result;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('token') ||
    normalized === 'authorization' ||
    normalized === 'access' ||
    normalized === 'refresh' ||
    normalized === 'code_verifier' ||
    normalized === 'key'
  );
}
