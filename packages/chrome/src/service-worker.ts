import {
  ArcGisRestClientImpl,
  EnvironmentManager,
  FetchArcGisRestTransport,
  deserializeMessage,
  mapRestError,
  serializeMessage,
  type ArcGisRestClient,
  type ApiKeyCredential,
  type EnvironmentConfig,
  type HostToWebviewMessage,
  type RestClientError,
  type WebviewToHostMessage
} from '@arcgis-api-keys/core';
import { ChromeAuthAdapter } from './adapters/chrome-auth-adapter.js';
import { ChromeStorageAdapter } from './adapters/chrome-storage-adapter.js';
import {
  CHROME_MESSAGE_SCOPE,
  isChromeRequestMessage,
  type ChromeRequestMessage,
  type ChromeResponseMessage,
  type ChromeState
} from './runtime-types.js';

interface Services {
  manager: EnvironmentManager;
  storage: ChromeStorageAdapter;
  auth: ChromeAuthAdapter;
  restClient: ArcGisRestClient;
}

let servicesPromise: Promise<Services> | null = null;

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isChromeRequestMessage(message)) {
    return false;
  }

  void handleChromeRequest(message)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown extension error.'
      } satisfies ChromeResponseMessage);
    });

  return true;
});

async function handleChromeRequest(message: ChromeRequestMessage): Promise<ChromeResponseMessage> {
  const services = await getServices();

  switch (message.type) {
    case 'popup/get-state': {
      const state = await readState(services);
      return { ok: true, state };
    }
    case 'popup/add-environment': {
      const environment = await addEnvironment(services, message.payload);
      if (environment.type === 'enterprise' && environment.portalUrl) {
        await requestEnterprisePermission(environment.portalUrl);
      }

      await pushStateUpdate(services);
      return { ok: true, state: await readState(services) };
    }
    case 'popup/remove-environment': {
      await services.manager.removeEnvironment(message.payload.environmentId);
      await pushStateUpdate(services);
      return { ok: true, state: await readState(services) };
    }
    case 'popup/select-environment': {
      await services.manager.setActiveEnvironment(message.payload.environmentId);
      await pushStateUpdate(services);
      return { ok: true, state: await readState(services) };
    }
    case 'popup/sign-in': {
      const environment = findEnvironmentById(services, message.payload.environmentId);
      const token = await services.auth.signIn(environment);
      await services.storage.setToken(environment.id, token);
      await services.manager.setActiveEnvironment(environment.id);
      await openExplorerTab();
      await pushStateUpdate(services);
      return { ok: true, state: await readState(services) };
    }
    case 'popup/sign-out': {
      const environment = findEnvironmentById(services, message.payload.environmentId);
      await services.auth.signOut(environment);
      await services.storage.clearToken(environment.id);
      await pushStateUpdate(services);
      return { ok: true, state: await readState(services) };
    }
    case 'enterprise/request-permission': {
      const granted = await requestEnterprisePermission(message.payload.portalUrl);
      return { ok: true, granted };
    }
    case 'explorer/webview-message': {
      const webviewMessage = deserializeMessage(message.payload.message);
      if (!webviewMessage.type.startsWith('webview/')) {
        return {
          ok: true,
          hostMessage: serializeMessage(toHostError('Invalid explorer request message.', true))
        };
      }

      const hostMessage = await handleWebviewMessage(services, webviewMessage as WebviewToHostMessage);
      return {
        ok: true,
        hostMessage: serializeMessage(hostMessage)
      };
    }
    default:
      return {
        ok: false,
        error: `Unsupported message type: ${String(message satisfies never)}`
      };
  }
}

async function handleWebviewMessage(
  services: Services,
  message: WebviewToHostMessage
): Promise<HostToWebviewMessage> {
  const environment = getActiveEnvironment(services);

  switch (message.type) {
    case 'webview/initialize':
      return buildStateMessage(services);
    case 'webview/select-environment': {
      await services.manager.setActiveEnvironment(message.payload.environmentId);
      await pushStateUpdate(services);
      return buildStateMessage(services);
    }
    case 'webview/sign-in': {
      if (!environment) {
        return toHostError('No environment configured. Add one in the popup.', true);
      }

      const token = await services.auth.signIn(environment);
      await services.storage.setToken(environment.id, token);
      await services.manager.setActiveEnvironment(environment.id);
      await pushStateUpdate(services);
      return buildStateMessage(services);
    }
    case 'webview/sign-out': {
      if (!environment) {
        return toHostError('No environment configured. Add one in the popup.', true);
      }

      await services.auth.signOut(environment);
      await services.storage.clearToken(environment.id);
      await pushStateUpdate(services);
      return buildStateMessage(services);
    }
    case 'webview/load-credentials': {
      if (!environment) {
        return toHostError('No environment configured. Add one in the popup.', true);
      }

      const token = await services.storage.getToken(environment.id);
      if (!token || token.expiresAt <= Date.now()) {
        return toHostError('Session expired. Sign in again to continue.', true, 'SESSION_EXPIRED');
      }

      try {
        const credentials = await services.restClient.fetchCredentials({
          environment,
          accessToken: token.accessToken
        });
        const payload: { credentials: ApiKeyCredential[] } = {
          credentials: [...credentials].sort(
            (left, right) => Date.parse(right.created) - Date.parse(left.created)
          )
        };
        const warnings = services.restClient.getLastResponseValidationWarnings();
        if (warnings.length > 0) {
          (payload as Record<string, unknown>).warnings = warnings;
        }

        return {
          type: 'host/credentials',
          payload
        };
      } catch (error) {
        return toHostErrorPayload(error);
      }
    }
    case 'webview/load-credential-detail': {
      if (!environment) {
        return toHostError('No environment configured. Add one in the popup.', true);
      }

      const accessToken = await getValidAccessToken(services, environment);
      if (!accessToken) {
        return toHostError('Session expired. Sign in again to continue.', true, 'SESSION_EXPIRED');
      }

      try {
        const credential = await services.restClient.fetchCredentialDetail({
          environment,
          accessToken,
          credentialId: message.payload.credentialId
        });

        return {
          type: 'host/credential-detail',
          payload: { credential }
        };
      } catch (error) {
        return toHostErrorPayload(error);
      }
    }
    case 'webview/key-action': {
      if (!environment) {
        return toHostError('No environment configured. Add one in the popup.', true);
      }

      const accessToken = await getValidAccessToken(services, environment);
      if (!accessToken) {
        return toHostError('Session expired. Sign in again to continue.', true, 'SESSION_EXPIRED');
      }

      try {
        const result =
          message.payload.action === 'create'
            ? await services.restClient.createApiKey({
                environment,
                accessToken,
                credentialId: message.payload.credentialId,
                slot: message.payload.slot,
                expirationDays: message.payload.expirationDays
              })
            : await services.restClient.regenerateApiKey({
                environment,
                accessToken,
                credentialId: message.payload.credentialId,
                slot: message.payload.slot,
                expirationDays: message.payload.expirationDays
              });

        return {
          type: 'host/key-action-result',
          payload: { result }
        };
      } catch (error) {
        return toHostErrorPayload(error);
      }
    }
    default:
      return toHostError(`Unsupported webview message: ${message.type}`, true);
  }
}

async function getServices(): Promise<Services> {
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const storage = new ChromeStorageAdapter();
      const manager = new EnvironmentManager(storage);
      await manager.load();

      return {
        storage,
        manager,
        auth: new ChromeAuthAdapter(),
        restClient: new ArcGisRestClientImpl(new FetchArcGisRestTransport())
      };
    })();
  }

  return servicesPromise;
}

function listEnvironments(services: Services): EnvironmentConfig[] {
  const grouped = services.manager.listEnvironments();
  return [...grouped.online, ...grouped['location-platform'], ...grouped.enterprise];
}

function getActiveEnvironment(services: Services): EnvironmentConfig | null {
  const active = services.manager.getActiveEnvironment();
  if (active) {
    return active;
  }

  return listEnvironments(services)[0] ?? null;
}

async function readState(services: Services): Promise<ChromeState> {
  const environment = getActiveEnvironment(services);
  const token = environment ? await services.storage.getToken(environment.id) : null;

  return {
    environments: listEnvironments(services),
    activeEnvironmentId: environment?.id ?? null,
    signedIn: Boolean(token && token.expiresAt > Date.now())
  };
}

async function buildStateMessage(services: Services): Promise<HostToWebviewMessage> {
  const state = await readState(services);
  return {
    type: 'host/state',
    payload: {
      environments: state.environments,
      activeEnvironmentId: state.activeEnvironmentId,
      signedIn: state.signedIn
    }
  };
}

async function getValidAccessToken(
  services: Services,
  environment: EnvironmentConfig
): Promise<string | null> {
  const token = await services.storage.getToken(environment.id);
  if (!token || token.expiresAt <= Date.now()) {
    return null;
  }

  return token.accessToken;
}

function findEnvironmentById(services: Services, environmentId: string): EnvironmentConfig {
  const environment = listEnvironments(services).find((item) => item.id === environmentId);
  if (!environment) {
    throw new Error(`Environment not found: ${environmentId}`);
  }

  return environment;
}

async function addEnvironment(
  services: Services,
  payload: { type: EnvironmentConfig['type']; name: string; clientId: string; portalUrl?: string }
): Promise<EnvironmentConfig> {
  const environment: EnvironmentConfig = {
    id: `${payload.type}-${Date.now()}`,
    name: payload.name.trim(),
    type: payload.type,
    clientId: payload.clientId.trim(),
    portalUrl: payload.portalUrl?.trim()
  };

  if (!environment.name) {
    throw new Error('Environment name is required.');
  }

  if (!environment.clientId) {
    throw new Error('Client ID is required.');
  }

  if (environment.type === 'enterprise' && !environment.portalUrl) {
    throw new Error('Enterprise portal URL is required.');
  }

  await services.manager.addEnvironment(environment);
  if (!services.manager.getActiveEnvironment()) {
    await services.manager.setActiveEnvironment(environment.id);
  }

  return environment;
}

async function requestEnterprisePermission(portalUrl: string): Promise<boolean> {
  const origin = new URL(portalUrl).origin;
  const permissions = {
    origins: [`${origin}/*`]
  };

  const alreadyGranted = await chrome.permissions.contains(permissions);
  if (alreadyGranted) {
    return true;
  }

  return chrome.permissions.request(permissions);
}

async function openExplorerTab(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('explorer.html')
  });
}

function toHostError(
  message: string,
  recoverable: boolean,
  code?: RestClientError['code']
): HostToWebviewMessage {
  return {
    type: 'host/error',
    payload: {
      message,
      code,
      recoverable
    }
  };
}

function toHostErrorPayload(error: unknown): HostToWebviewMessage {
  const mapped = mapRestError(error);
  return toHostError(mapped.message, mapped.recoverable, mapped.code);
}

async function pushStateUpdate(services: Services): Promise<void> {
  const stateMessage = await buildStateMessage(services);
  const payload = {
    scope: CHROME_MESSAGE_SCOPE,
    type: 'host/push' as const,
    payload: {
      message: serializeMessage(stateMessage)
    }
  };

  try {
    await chrome.runtime.sendMessage(payload);
  } catch {
    // Ignore when there are no listeners.
  }
}
