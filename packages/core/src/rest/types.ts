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

export type KeyMutationAction = 'create' | 'regenerate' | 'revoke';

export interface KeyMutationResult {
  action: KeyMutationAction;
  key?: string;
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

export interface FetchPortalBaseOptions {
  environment: EnvironmentConfig;
  accessToken: string;
}

export interface FetchUserTagsOptions {
  environment: EnvironmentConfig;
  accessToken: string;
}

export interface UpdateItemMetadataOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
  title: string;
  snippet: string;
  tags: string[];
}

export interface UpdateCredentialReferrersOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
  referrers: string[];
}

export interface ToggleItemDeleteProtectionOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
  protect: boolean;
}

export interface CredentialDeleteCheckOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
}

export interface DeleteCredentialOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
  permanentDelete?: boolean;
}

export interface ToggleCredentialFavoriteOptions {
  environment: EnvironmentConfig;
  accessToken: string;
  credentialId: string;
  favorite: boolean;
}

export interface ArcGisRestClient {
  fetchCredentials(options: FetchCredentialsOptions): Promise<ApiKeyCredential[]>;
  fetchCredentialDetail(options: FetchCredentialDetailOptions): Promise<ApiKeyCredential>;
  fetchPortalBase(options: FetchPortalBaseOptions): Promise<string>;
  createApiKey(options: KeyMutationOptions): Promise<KeyMutationResult>;
  regenerateApiKey(options: KeyMutationOptions): Promise<KeyMutationResult>;
  revokeApiKey(options: KeyMutationOptions): Promise<KeyMutationResult>;
  detectCapabilities(environment: EnvironmentConfig, accessToken: string): Promise<ArcGisClientCapabilities>;
  getLastResponseValidationWarnings(): string[];
  fetchUserTags(options: FetchUserTagsOptions): Promise<string[]>;
  updateItemMetadata(options: UpdateItemMetadataOptions): Promise<void>;
  updateCredentialReferrers(options: UpdateCredentialReferrersOptions): Promise<void>;
  toggleItemDeleteProtection(options: ToggleItemDeleteProtectionOptions): Promise<void>;
  canDeleteCredential(options: CredentialDeleteCheckOptions): Promise<boolean>;
  deleteCredential(options: DeleteCredentialOptions): Promise<void>;
  toggleCredentialFavorite(options: ToggleCredentialFavoriteOptions): Promise<void>;
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
