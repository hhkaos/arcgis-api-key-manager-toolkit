import type { EnvironmentConfig, HostToWebviewMessage } from '@arcgis-api-keys/core';

export const CHROME_MESSAGE_SCOPE = 'arcgis-api-keys';

export type ChromeRequestMessage =
  | { scope: typeof CHROME_MESSAGE_SCOPE; type: 'popup/get-state' }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'popup/add-environment';
      payload: {
        type: EnvironmentConfig['type'];
        name: string;
        clientId: string;
        portalUrl?: string;
      };
    }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'popup/remove-environment';
      payload: { environmentId: string };
    }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'popup/select-environment';
      payload: { environmentId: string };
    }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'popup/sign-in';
      payload: { environmentId: string };
    }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'popup/sign-out';
      payload: { environmentId: string };
    }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'explorer/webview-message';
      payload: { message: string };
    }
  | {
      scope: typeof CHROME_MESSAGE_SCOPE;
      type: 'enterprise/request-permission';
      payload: { portalUrl: string };
    };

export interface ChromeState {
  environments: EnvironmentConfig[];
  activeEnvironmentId: string | null;
  signedIn: boolean;
}

export type ChromeResponseMessage =
  | {
      ok: true;
      state?: ChromeState;
      hostMessage?: string;
      granted?: boolean;
    }
  | {
      ok: false;
      error: string;
    };

export interface ChromePushMessage {
  scope: typeof CHROME_MESSAGE_SCOPE;
  type: 'host/push';
  payload: { message: string };
}

export function isChromeRequestMessage(value: unknown): value is ChromeRequestMessage {
  if (!isRecord(value)) {
    return false;
  }

  return value.scope === CHROME_MESSAGE_SCOPE && typeof value.type === 'string';
}

export function isChromePushMessage(value: unknown): value is ChromePushMessage {
  if (!isRecord(value)) {
    return false;
  }

  return value.scope === CHROME_MESSAGE_SCOPE && value.type === 'host/push';
}

export function isHostMessage(value: unknown): value is HostToWebviewMessage {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.type === 'string' && value.type.startsWith('host/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
