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

export interface CredentialMetadataUpdateRequest {
  credentialId: string;
  title: string;
  snippet: string;
  tags: string[];
}

export interface CredentialReferrersUpdateRequest {
  credentialId: string;
  referrers: string[];
}

export interface CredentialDeleteProtectionRequest {
  credentialId: string;
  protect: boolean;
}

export interface CredentialFavoriteRequest {
  credentialId: string;
  favorite: boolean;
}

export interface CredentialDeleteCheckRequest {
  credentialId: string;
}

export interface CredentialDeleteExecuteRequest {
  credentialId: string;
  permanentDelete?: boolean;
}

export type HostToWebviewMessage =
  | ProtocolEnvelope<'host/state', HostStatePayload>
  | ProtocolEnvelope<'host/credentials', { credentials: ApiKeyCredential[]; portalBase?: string }>
  | ProtocolEnvelope<'host/credential-detail', { credential: ApiKeyCredential }>
  | ProtocolEnvelope<'host/key-action-result', { result: KeyMutationResult }>
  | ProtocolEnvelope<'host/user-tags', { tags: string[] }>
  | ProtocolEnvelope<'host/credential-metadata-updated', { credential: ApiKeyCredential }>
  | ProtocolEnvelope<'host/credential-delete-check-result', { credentialId: string; canDelete: boolean }>
  | ProtocolEnvelope<'host/credential-deleted', { credentialId: string }>
  | ProtocolEnvelope<'host/error', HostErrorPayload>;

export type WebviewToHostMessage =
  | ProtocolEnvelope<'webview/initialize', Record<string, never>>
  | ProtocolEnvelope<'webview/select-environment', { environmentId: string }>
  | ProtocolEnvelope<'webview/sign-in', Record<string, never>>
  | ProtocolEnvelope<'webview/sign-out', Record<string, never>>
  | ProtocolEnvelope<'webview/load-credentials', CredentialsQuery>
  | ProtocolEnvelope<'webview/load-credential-detail', { credentialId: string }>
  | ProtocolEnvelope<'webview/key-action', CredentialKeyActionRequest>
  | ProtocolEnvelope<'webview/open-external-url', { url: string }>
  | ProtocolEnvelope<'webview/ack-error', { code?: string }>
  | ProtocolEnvelope<'webview/fetch-user-tags', Record<string, never>>
  | ProtocolEnvelope<'webview/update-credential-metadata', CredentialMetadataUpdateRequest>
  | ProtocolEnvelope<'webview/update-credential-referrers', CredentialReferrersUpdateRequest>
  | ProtocolEnvelope<'webview/toggle-credential-delete-protection', CredentialDeleteProtectionRequest>
  | ProtocolEnvelope<'webview/toggle-credential-favorite', CredentialFavoriteRequest>
  | ProtocolEnvelope<'webview/check-credential-delete', CredentialDeleteCheckRequest>
  | ProtocolEnvelope<'webview/delete-credential', CredentialDeleteExecuteRequest>;

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
    'host/user-tags',
    'host/credential-metadata-updated',
    'host/credential-delete-check-result',
    'host/credential-deleted',
    'host/error',
    'webview/initialize',
    'webview/select-environment',
    'webview/sign-in',
    'webview/sign-out',
    'webview/load-credentials',
    'webview/load-credential-detail',
    'webview/key-action',
    'webview/open-external-url',
    'webview/ack-error',
    'webview/fetch-user-tags',
    'webview/update-credential-metadata',
    'webview/update-credential-referrers',
    'webview/toggle-credential-delete-protection',
    'webview/toggle-credential-favorite',
    'webview/check-credential-delete',
    'webview/delete-credential'
  ]);

  return allowedTypes.has(value.type);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
