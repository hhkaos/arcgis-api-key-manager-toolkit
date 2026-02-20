export type EnvironmentType = 'online' | 'location-platform' | 'enterprise';

export interface EnvironmentConfig {
  id: string;
  name: string;
  type: EnvironmentType;
  clientId: string;
  portalUrl?: string;
}

export interface AuthToken {
  accessToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

export interface KeySlotStatus {
  slot: 1 | 2;
  exists: boolean;
  partialId?: string;
  created?: string;
}

export interface ApiKeyCredential {
  id: string;
  name: string;
  tags: string[];
  privileges: string[];
  created: string;
  expiration: string;
  referrers: string[];
  key1: KeySlotStatus;
  key2: KeySlotStatus;
}

export type ExpirationCategory = 'ok' | 'warning' | 'critical' | 'expired';

export interface CredentialFilter {
  search?: string;
  tag?: string;
  privilege?: string;
  expiration?: ExpirationCategory;
}

export type CredentialSortField = 'name' | 'expiration' | 'created';

export type SortDirection = 'asc' | 'desc';

export interface CredentialSort {
  field: CredentialSortField;
  direction?: SortDirection;
}

export interface ReferrerAnnotation {
  value: string;
  warning: boolean;
  reason?: 'wildcard-only' | 'permissive-pattern' | 'none';
}

