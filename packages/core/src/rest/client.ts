import type { ApiKeyCredential, EnvironmentConfig } from '../types/models.js';
import { mapRestError } from './errors.js';
import type {
  ArcGisClientCapabilities,
  ArcGisPagedCredentialsResponse,
  ArcGisRestClient,
  ArcGisRestTransport,
  FetchCredentialDetailOptions,
  FetchCredentialsOptions,
  KeyMutationOptions,
  KeyMutationResult
} from './types.js';

const DEFAULT_PAGE_SIZE = 100;

interface PortalCapabilitiesResponse {
  currentVersion?: number;
}

interface KeyMutationResponse {
  key?: string;
}

export class ArcGisRestClientImpl implements ArcGisRestClient {
  private readonly transport: ArcGisRestTransport;

  public constructor(transport: ArcGisRestTransport) {
    this.transport = transport;
  }

  public async fetchCredentials(options: FetchCredentialsOptions): Promise<ApiKeyCredential[]> {
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    try {
      return await this.fetchCredentialsFromPath('/portals/self/apiKeys', options, pageSize);
    } catch (error) {
      throw mapRestError(error);
    }
  }

  public async fetchCredentialDetail(options: FetchCredentialDetailOptions): Promise<ApiKeyCredential> {
    try {
      return await this.transport.request<ApiKeyCredential>({
        path: `/portals/self/apiKeys/${options.credentialId}`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });
    } catch (error) {
      throw mapRestError(error);
    }
  }

  public async createApiKey(options: KeyMutationOptions): Promise<KeyMutationResult> {
    return this.runKeyMutation(options, 'create');
  }

  public async regenerateApiKey(options: KeyMutationOptions): Promise<KeyMutationResult> {
    return this.runKeyMutation(options, 'regenerate');
  }

  public async detectCapabilities(
    environment: EnvironmentConfig,
    accessToken: string
  ): Promise<ArcGisClientCapabilities> {
    if (environment.type === 'online' || environment.type === 'location-platform') {
      return {
        canListCredentials: true,
        canViewCredentialDetail: true,
        canCreateApiKey: true,
        canRegenerateApiKey: true
      };
    }

    try {
      const portal = await this.transport.request<PortalCapabilitiesResponse>({
        path: '/portals/self',
        method: 'GET',
        environment,
        accessToken,
        query: { f: 'json' }
      });

      const version = portal.currentVersion ?? 0;
      if (version >= 11.2) {
        return {
          canListCredentials: true,
          canViewCredentialDetail: true,
          canCreateApiKey: true,
          canRegenerateApiKey: true
        };
      }

      return {
        canListCredentials: true,
        canViewCredentialDetail: true,
        canCreateApiKey: false,
        canRegenerateApiKey: false,
        reason: 'This ArcGIS Enterprise version may not support API key create/regenerate operations.'
      };
    } catch {
      return {
        canListCredentials: false,
        canViewCredentialDetail: false,
        canCreateApiKey: false,
        canRegenerateApiKey: false,
        reason: 'Unable to detect Enterprise capabilities for this portal.'
      };
    }
  }

  private async runKeyMutation(
    options: KeyMutationOptions,
    action: 'create' | 'regenerate'
  ): Promise<KeyMutationResult> {
    try {
      const response = await this.transport.request<KeyMutationResponse>({
        path: `/portals/self/apiKeys/${options.credentialId}/keys/${options.slot}/${action}`,
        method: 'POST',
        environment: options.environment,
        accessToken: options.accessToken,
        body: {
          expirationDays: options.expirationDays,
          f: 'json'
        }
      });

      if (!response.key) {
        throw {
          error: {
            code: 500,
            message: 'ArcGIS response did not include a key value.'
          }
        };
      }

      return {
        key: response.key,
        slot: options.slot,
        credentialId: options.credentialId
      };
    } catch (error) {
      throw mapRestError(error);
    }
  }

  private async fetchCredentialsFromPath(
    path: string,
    options: FetchCredentialsOptions,
    pageSize: number
  ): Promise<ApiKeyCredential[]> {
    const credentials: ApiKeyCredential[] = [];
    let nextStart = 1;

    while (nextStart > 0) {
      const response = await this.transport.request<ArcGisPagedCredentialsResponse>({
        path,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: {
          start: nextStart,
          num: pageSize,
          f: 'json'
        }
      });

      credentials.push(...this.extractCredentials(response));
      nextStart = this.readNextStart(response);
    }

    return dedupeCredentials(credentials);
  }

  private extractCredentials(response: ArcGisPagedCredentialsResponse): ApiKeyCredential[] {
    const records =
      toArray(response.credentials) ??
      toArray(response.apiKeys) ??
      toArray(response.apiKeyCredentials) ??
      toArray(response.apiTokens) ??
      toArray(response.results) ??
      toArray(response.data) ??
      toArray(response.items) ??
      [];

    return records
      .map((record) => toCredential(record))
      .filter((credential): credential is ApiKeyCredential => Boolean(credential));
  }

  private readNextStart(response: ArcGisPagedCredentialsResponse): number {
    const value = response.nextStart;
    if (typeof value !== 'number') {
      return -1;
    }

    return value;
  }
}

export function getArcGisRestBaseUrl(environment: EnvironmentConfig): string {
  if (environment.type === 'enterprise') {
    const portalUrl = environment.portalUrl?.replace(/\/$/, '');
    if (!portalUrl) {
      throw new Error('Enterprise environment requires a portal URL.');
    }

    return `${portalUrl}/sharing/rest`;
  }

  return 'https://www.arcgis.com/sharing/rest';
}

function toArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function toCredential(record: unknown): ApiKeyCredential | null {
  if (typeof record === 'string' || typeof record === 'number') {
    const primitiveId = readLooseString(record);
    if (!primitiveId) {
      return null;
    }

    const now = new Date(0).toISOString();
    return {
      id: primitiveId,
      name: primitiveId,
      tags: [],
      privileges: [],
      created: now,
      expiration: now,
      referrers: [],
      key1: { slot: 1, exists: false },
      key2: { slot: 2, exists: false }
    };
  }

  if (!isRecord(record)) {
    return null;
  }

  const source = pickSourceRecord(record);

  const id =
    readLooseString(source.id) ??
    readLooseString(source.credentialId) ??
    readLooseString(source.itemId) ??
    readLooseString(source.clientId) ??
    readLooseString(source.name) ??
    readLooseString(source.title);
  if (!id) {
    return null;
  }

  const created = toIsoDate(
    readDateLike(source.created) ??
      readDateLike(source.createdAt) ??
      readDateLike(source.creationDate) ??
      readDateLike(source.lastModified) ??
      0
  );
  const expiration = toIsoDate(
    readDateLike(source.expiration) ??
      readDateLike(source.expires) ??
      readDateLike(source.expiresAt) ??
      readDateLike(source.expiry) ??
      Date.now()
  );

  return {
    id,
    name: readLooseString(source.name) ?? readLooseString(source.title) ?? id,
    tags: toStringArray(source.tags) ?? [],
    privileges: toStringArray(source.privileges) ?? toStringArray(source.scopes) ?? [],
    created,
    expiration,
    referrers:
      toStringArray(source.referrers) ??
      toStringArray(source.httpReferrers) ??
      toStringArray(source.allowedReferrers) ??
      toStringArray(source.referers) ??
      [],
    key1: {
      slot: 1,
      exists:
        readBoolean(source.key1Exists) ??
        readBoolean(readNested(source, ['key1', 'exists'])) ??
        false,
      partialId:
        readLooseString(readNested(source, ['key1', 'partialId'])) ??
        readLooseString(readNested(source, ['key1', 'id'])),
      created: toOptionalIsoDate(readDateLike(readNested(source, ['key1', 'created'])))
    },
    key2: {
      slot: 2,
      exists:
        readBoolean(source.key2Exists) ??
        readBoolean(readNested(source, ['key2', 'exists'])) ??
        false,
      partialId:
        readLooseString(readNested(source, ['key2', 'partialId'])) ??
        readLooseString(readNested(source, ['key2', 'id'])),
      created: toOptionalIsoDate(readDateLike(readNested(source, ['key2', 'created'])))
    }
  };
}

function pickSourceRecord(record: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(record.credential)) {
    return record.credential;
  }

  if (isRecord(record.apiKey)) {
    return record.apiKey;
  }

  if (isRecord(record.item)) {
    return record.item;
  }

  if (isRecord(record.developerCredential)) {
    return record.developerCredential;
  }

  return record;
}

function dedupeCredentials(credentials: ApiKeyCredential[]): ApiKeyCredential[] {
  const byId = new Map<string, ApiKeyCredential>();
  for (const credential of credentials) {
    byId.set(credential.id, credential);
  }
  return [...byId.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readLooseString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readDateLike(value: unknown): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function toIsoDate(value: number | string): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function toOptionalIsoDate(value: number | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return toIsoDate(value);
}

function readNested(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}
