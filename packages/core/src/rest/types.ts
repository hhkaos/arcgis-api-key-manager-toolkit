import type { ApiKeyCredential, EnvironmentConfig } from '../types/models.js';

export interface ArcGisRestRequest {
  path: string;
  method: 'GET' | 'POST';
  environment: EnvironmentConfig;
  accessToken: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, string | number | boolean | undefined>;
}

export interface ArcGisRestTransport {
  request<TResponse>(request: ArcGisRestRequest): Promise<TResponse>;
}

export interface FetchCredentialsOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  pageSize?: number;
}

export interface FetchCredentialDetailOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
}

export interface KeyMutationOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
  slot: 1 | 2;
  expirationDays?: number;
}

export interface KeyMutationResult {
  key: string;
  slot: 1 | 2;
  credentialId: string;
}

export interface ArcGisClientCapabilities {
  canListCredentials: boolean;
  canViewCredentialDetail: boolean;
  canCreateApiKey: boolean;
  canRegenerateApiKey: boolean;
  reason?: string;
}

export interface ArcGisRestClient {
  fetchCredentials(options: FetchCredentialsOptions): Promise<ApiKeyCredential[]>;
  fetchCredentialDetail(options: FetchCredentialDetailOptions): Promise<ApiKeyCredential>;
  createApiKey(options: KeyMutationOptions): Promise<KeyMutationResult>;
  regenerateApiKey(options: KeyMutationOptions): Promise<KeyMutationResult>;
  detectCapabilities(environment: EnvironmentConfig, accessToken: string): Promise<ArcGisClientCapabilities>;
  getLastResponseValidationWarnings(): string[];
}

export type RestClientErrorCode =
  | 'SESSION_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_FEATURE'
  | 'UNKNOWN';

export interface RestClientError {
  code: RestClientErrorCode;
  message: string;
  recoverable: boolean;
  httpStatus?: number;
  details?: unknown;
}

export interface ArcGisPortalError {
  code?: number;
  message?: string;
  details?: unknown;
}

export interface ArcGisPagedCredentialsResponse {
  credentials?: ApiKeyCredential[];
  apiKeys?: unknown[];
  apiKeyCredentials?: unknown[];
  apiTokens?: unknown[];
  items?: unknown[];
  nextStart?: number;
  total?: number;
  [key: string]: unknown;
}
