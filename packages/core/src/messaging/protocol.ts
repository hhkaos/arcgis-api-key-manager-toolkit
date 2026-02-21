import type { ApiKeyCredential, EnvironmentConfig } from '../types/models.js';
import type {
  ArcGisClientCapabilities,
  KeyMutationAction,
  KeyMutationResult,
  RestClientError
} from '../rest/types.js';

export type MessageDirection = 'host-to-webview' | 'webview-to-host';

export interface ProtocolEnvelope<TType extends string, TPayload> {
  type: TType;
  requestId?: string;
  payload: TPayload;
}

export interface CredentialsQuery {
  refresh?: boolean;
}

export interface CredentialKeyActionRequest {
  credentialId: string;
  slot: 1 | 2;
  action: KeyMutationAction;
  expirationDays?: number;
}

export interface HostStatePayload {
  environments: EnvironmentConfig[];
  activeEnvironmentId: string | null;
  signedIn: boolean;
  capabilities?: ArcGisClientCapabilities;
}

export interface HostErrorPayload {
  message: string;
  code?: string;
  recoverable: boolean;
}

export type HostToWebviewMessage =
  | ProtocolEnvelope<'host/state', HostStatePayload>
  | ProtocolEnvelope<'host/credentials', { credentials: ApiKeyCredential[]; portalBase?: string }>
  | ProtocolEnvelope<'host/credential-detail', { credential: ApiKeyCredential }>
  | ProtocolEnvelope<'host/key-action-result', { result: KeyMutationResult }>
  | ProtocolEnvelope<'host/error', HostErrorPayload>;

export type WebviewToHostMessage =
  | ProtocolEnvelope<'webview/initialize', Record<string, never>>
  | ProtocolEnvelope<'webview/select-environment', { environmentId: string }>
  | ProtocolEnvelope<'webview/sign-in', Record<string, never>>
  | ProtocolEnvelope<'webview/sign-out', Record<string, never>>
  | ProtocolEnvelope<'webview/load-credentials', CredentialsQuery>
  | ProtocolEnvelope<'webview/load-credential-detail', { credentialId: string }>
  | ProtocolEnvelope<'webview/key-action', CredentialKeyActionRequest>
  | ProtocolEnvelope<'webview/ack-error', { code?: string }>;

export type WebviewProtocolMessage = HostToWebviewMessage | WebviewToHostMessage;

export function serializeMessage(message: WebviewProtocolMessage): string {
  return JSON.stringify(message);
}

export function deserializeMessage(raw: string): WebviewProtocolMessage {
  const parsed = JSON.parse(raw) as unknown;

  if (!isProtocolMessage(parsed)) {
    throw new Error('Invalid WebView protocol message.');
  }

  return parsed;
}

export function toHostErrorPayload(error: RestClientError): HostErrorPayload {
  return {
    message: error.message,
    code: error.code,
    recoverable: error.recoverable
  };
}

function isProtocolMessage(value: unknown): value is WebviewProtocolMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.type !== 'string' || !isRecord(value.payload)) {
    return false;
  }

  if (value.requestId !== undefined && typeof value.requestId !== 'string') {
    return false;
  }

  const allowedTypes = new Set<string>([
    'host/state',
    'host/credentials',
    'host/credential-detail',
    'host/key-action-result',
    'host/error',
    'webview/initialize',
    'webview/select-environment',
    'webview/sign-in',
    'webview/sign-out',
    'webview/load-credentials',
    'webview/load-credential-detail',
    'webview/key-action',
    'webview/ack-error'
  ]);

  return allowedTypes.has(value.type);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
