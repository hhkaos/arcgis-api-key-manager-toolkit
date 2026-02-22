import type { ApiKeyCredential, EnvironmentConfig } from '../types/models.js';
import { mapRestError } from './errors.js';
import type {
  ArcGisClientCapabilities,
  ArcGisPagedCredentialsResponse,
  ArcGisRestClient,
  ArcGisRestTransport,
  FetchCredentialDetailOptions,
  FetchCredentialsOptions,
  FetchUserTagsOptions,
  KeyMutationAction,
  KeyMutationOptions,
  KeyMutationResult,
  UpdateItemMetadataOptions
} from './types.js';

const DEFAULT_PAGE_SIZE = 100;
const NON_EXPIRING_DATE_ISO = '9999-12-31T00:00:00.000Z';
const SEARCH_FILTER_BASE =
  '-typekeywords:("MapAreaPackage") -type:("Map Area" OR "Indoors Map Configuration" OR "Code Attachment")';
const NEW_API_KEYS_FILTER_SUFFIX =
  '(type:"Application" AND typekeywords:("Registered App" AND "APIToken"))';
const LEGACY_API_KEYS_FILTER_SUFFIX = '(type:"API Key")';

interface PortalCapabilitiesResponse {
  currentVersion?: number;
}

interface KeyMutationResponse {
  success?: boolean;
}

interface OAuthTokenMutationResponse {
  access_token?: string;
}

interface RegisteredAppInfoResponse {
  client_id?: string;
  clientId?: string;
  client_secret?: string;
  clientSecret?: string;
}

interface ItemOwnerResponse {
  owner?: string;
}

interface CommunitySelfResponse {
  id?: string;
  username?: string;
  user?: {
    username?: string;
  };
}

interface UserTagsResponse {
  tags?: Array<{ tag?: string; count?: number } | string>;
}

interface PortalSelfResponse {
  id?: string;
  urlKey?: string;
  customBaseUrl?: string;
  user?: {
    username?: string;
  };
  username?: string;
}

interface ItemGroupsResponse {
  snippet?: unknown;
  groups?: unknown[];
  results?: unknown[];
  items?: unknown[];
}

type ValidationEndpointKey =
  | '/search'
  | '/content/items'
  | '/content/users/items/registeredAppInfo'
  | '/portals/self/apiKeys';

interface EndpointValidationRule {
  endpoint: ValidationEndpointKey;
  objectPath: string[];
  requiredFields: string[];
}

const VALIDATION_RULES: EndpointValidationRule[] = [
  {
    endpoint: '/search',
    objectPath: ['results'],
    requiredFields: ['id', 'owner', 'title', 'type', 'apiToken1ExpirationDate', 'apiToken2ExpirationDate']
  },
  {
    endpoint: '/content/items',
    objectPath: [],
    requiredFields: ['id', 'owner', 'title', 'apiToken1ExpirationDate', 'apiToken2ExpirationDate']
  },
  {
    endpoint: '/content/users/items/registeredAppInfo',
    objectPath: [],
    requiredFields: ['itemId', 'privileges', 'httpReferrers', 'apiToken1Active', 'apiToken2Active']
  },
  {
    endpoint: '/portals/self/apiKeys',
    objectPath: ['apiKeys'],
    requiredFields: ['itemId', 'owner', 'httpReferrers', 'privileges']
  }
];

class ResponseShapeValidator {
  private readonly warnings = new Set<string>();
  private readonly validatedEndpoints = new Set<ValidationEndpointKey>();

  public validateFirstResponse(endpoint: ValidationEndpointKey, response: unknown): void {
    if (this.validatedEndpoints.has(endpoint)) {
      return;
    }
    this.validatedEndpoints.add(endpoint);

    const rule = VALIDATION_RULES.find((candidate) => candidate.endpoint === endpoint);
    if (!rule) {
      return;
    }

    const candidate = pickValidationObject(response, rule.objectPath);
    if (!candidate) {
      return;
    }

    for (const field of rule.requiredFields) {
      if (!(field in candidate)) {
        this.warnings.add(
          `Response validation warning: missing field "${field}" in first ${endpoint} response.`
        );
      }
    }
  }

  public toWarnings(): string[] {
    return [...this.warnings];
  }
}

export class ArcGisRestClientImpl implements ArcGisRestClient {
  private readonly transport: ArcGisRestTransport;
  private lastResponseValidationWarnings: string[] = [];

  public constructor(transport: ArcGisRestTransport) {
    this.transport = transport;
  }

  public async fetchCredentials(options: FetchCredentialsOptions): Promise<ApiKeyCredential[]> {
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const validator = new ResponseShapeValidator();
    this.lastResponseValidationWarnings = [];

    try {
      if (options.environment.type === 'online' || options.environment.type === 'location-platform') {
        try {
          const listed = await this.fetchCredentialsViaSearch(options, pageSize, validator);
          const enriched = await this.enrichCredentialsForOnlineList(options, listed, validator);
          this.lastResponseValidationWarnings = validator.toWarnings();
          return enriched;
        } catch {
          // Fall back to the legacy endpoint to avoid breaking older org configurations.
        }
      }

      const credentials = await this.fetchCredentialsFromPath(
        '/portals/self/apiKeys',
        options,
        pageSize,
        validator
      );
      this.lastResponseValidationWarnings = validator.toWarnings();
      return credentials;
    } catch (error) {
      this.lastResponseValidationWarnings = validator.toWarnings();
      throw mapRestError(error);
    }
  }

  public getLastResponseValidationWarnings(): string[] {
    return [...this.lastResponseValidationWarnings];
  }

  public async fetchCredentialDetail(options: FetchCredentialDetailOptions): Promise<ApiKeyCredential> {
    try {
      if (options.environment.type === 'online' || options.environment.type === 'location-platform') {
        const onlineDetail = await this.fetchCredentialDetailForOnline(options);
        if (onlineDetail) {
          return onlineDetail;
        }
      }

      const legacyDetail = await this.transport.request<unknown>({
        path: `/portals/self/apiKeys/${encodeURIComponent(options.credentialId)}`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });

      const credential = toCredential(legacyDetail);
      if (!credential) {
        throw {
          error: {
            code: 500,
            message: 'ArcGIS response did not include a valid API key credential payload.'
          }
        };
      }

      return credential;
    } catch (error) {
      throw mapRestError(error);
    }
  }

  public async fetchPortalBase(options: { environment: EnvironmentConfig; accessToken: string }): Promise<string> {
    const { environment, accessToken } = options;

    if (environment.type === 'enterprise') {
      return environment.portalUrl?.replace(/\/$/, '') ?? '';
    }

    try {
      const portal = await this.transport.request<PortalSelfResponse>({
        path: '/portals/self',
        method: 'GET',
        environment,
        accessToken,
        query: { f: 'json' }
      });

      const urlKey = readLooseString(portal.urlKey);
      const customBaseUrl = readLooseString(portal.customBaseUrl);
      if (urlKey && customBaseUrl) {
        return `https://${urlKey}.${customBaseUrl}`;
      }

      if (urlKey) {
        return `https://${urlKey}.maps.arcgis.com`;
      }
    } catch {
      // Fall through to default.
    }

    return 'https://www.arcgis.com';
  }

  public async createApiKey(options: KeyMutationOptions): Promise<KeyMutationResult> {
    return this.runKeyMutation(options, 'create');
  }

  public async regenerateApiKey(options: KeyMutationOptions): Promise<KeyMutationResult> {
    return this.runKeyMutation(options, 'regenerate');
  }

  public async revokeApiKey(options: KeyMutationOptions): Promise<KeyMutationResult> {
    return this.runKeyMutation(options, 'revoke');
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

  public async fetchUserTags(options: FetchUserTagsOptions): Promise<string[]> {
    try {
      const selfResponse = await this.transport.request<CommunitySelfResponse>({
        path: '/community/self',
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json', returnUserLicensedItems: true }
      });

      const userId = readLooseString(selfResponse.id);
      if (!userId) {
        return [];
      }

      const tagsResponse = await this.transport.request<UserTagsResponse>({
        path: `/community/users/${encodeURIComponent(userId)}/tags`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });

      const tags = tagsResponse.tags;
      if (!Array.isArray(tags)) {
        return [];
      }

      return tags
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (isRecord(item)) return readLooseString(item.tag) ?? '';
          return '';
        })
        .filter((tag) => tag.length > 0);
    } catch {
      return [];
    }
  }

  public async updateItemMetadata(options: UpdateItemMetadataOptions): Promise<void> {
    try {
      const item = await this.transport.request<ItemOwnerResponse>({
        path: `/content/items/${encodeURIComponent(options.credentialId)}`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });

      const owner = readLooseString(item.owner);
      if (!owner) {
        throw {
          error: {
            code: 500,
            message: 'ArcGIS item response did not include an owner for this credential.'
          }
        };
      }

      const response = await this.transport.request<{ success?: boolean }>({
        path: `/content/users/${encodeURIComponent(owner)}/items/${encodeURIComponent(options.credentialId)}/update`,
        method: 'POST',
        environment: options.environment,
        accessToken: options.accessToken,
        body: {
          f: 'json',
          title: options.title,
          snippet: options.snippet,
          tags: options.tags.join(','),
          clearEmptyFields: true
        }
      });

      if (response.success === false) {
        throw {
          error: {
            code: 500,
            message: 'ArcGIS did not confirm the item metadata update.'
          }
        };
      }
    } catch (error) {
      throw mapRestError(error);
    }
  }

  private async runKeyMutation(
    options: KeyMutationOptions,
    action: KeyMutationAction
  ): Promise<KeyMutationResult> {
    try {
      return await this.runDocumentedKeyMutationFlow(options, action);
    } catch (error) {
      throw mapRestError(error);
    }
  }

  private async runDocumentedKeyMutationFlow(
    options: KeyMutationOptions,
    action: KeyMutationAction
  ): Promise<KeyMutationResult> {
    const registration = await this.resolveRegisteredAppCredentials(options);

    if (action !== 'revoke') {
      await this.updateApiTokenExpiration(registration.owner, options);
    }

    if (action === 'revoke') {
      const response = await this.transport.request<KeyMutationResponse>({
        path: '/oauth2/revokeToken',
        method: 'POST',
        environment: options.environment,
        accessToken: options.accessToken,
        body: {
          f: 'json',
          client_id: registration.clientId,
          client_secret: registration.clientSecret,
          apiToken: options.slot
        }
      });

      if (response.success === false) {
        throw {
          error: {
            code: 500,
            message: 'ArcGIS response did not confirm key revocation.'
          }
        };
      }

      return {
        action,
        slot: options.slot,
        credentialId: options.credentialId
      };
    }

    const response = await this.transport.request<OAuthTokenMutationResponse>({
      path: '/oauth2/token',
      method: 'POST',
      environment: options.environment,
      accessToken: options.accessToken,
      body: {
        f: 'json',
        client_id: registration.clientId,
        client_secret: registration.clientSecret,
        grant_type: 'client_credentials',
        apiToken: options.slot,
        regenerateApiToken: action === 'regenerate'
      }
    });

    const key = readLooseString(response.access_token);
    if (!key) {
      throw {
        error: {
          code: 500,
          message: 'ArcGIS response did not include an API key value.'
        }
      };
    }

    return {
      action,
      key,
      slot: options.slot,
      credentialId: options.credentialId
    };
  }

  private async resolveRegisteredAppCredentials(
    options: KeyMutationOptions
  ): Promise<{ owner: string; clientId: string; clientSecret: string }> {
    const item = await this.transport.request<ItemOwnerResponse>({
      path: `/content/items/${encodeURIComponent(options.credentialId)}`,
      method: 'GET',
      environment: options.environment,
      accessToken: options.accessToken,
      query: { f: 'json' }
    });

    const owner = readLooseString(item.owner);
    if (!owner) {
      throw {
        error: {
          code: 500,
          message: 'ArcGIS item response did not include an owner for this API key.'
        }
      };
    }

    const registered = await this.transport.request<RegisteredAppInfoResponse>({
      path: `/content/users/${encodeURIComponent(owner)}/items/${encodeURIComponent(
        options.credentialId
      )}/registeredAppInfo`,
      method: 'GET',
      environment: options.environment,
      accessToken: options.accessToken,
      query: { f: 'json' }
    });

    const clientId = readLooseString(registered.client_id) ?? readLooseString(registered.clientId);
    const clientSecret =
      readLooseString(registered.client_secret) ?? readLooseString(registered.clientSecret);
    if (!clientId || !clientSecret) {
      throw {
        error: {
          code: 500,
          message: 'ArcGIS registered app info did not include client credentials.'
        }
      };
    }

    return { owner, clientId, clientSecret };
  }

  private async updateApiTokenExpiration(owner: string, options: KeyMutationOptions): Promise<void> {
    const expirationDate = toApiTokenExpirationDate(options.expirationDays);
    if (!expirationDate) {
      throw {
        error: {
          code: 400,
          message: 'Expiration date is required to generate or regenerate an API key.'
        }
      };
    }

    const response = await this.transport.request<{ success?: boolean }>({
      path: `/content/users/${encodeURIComponent(owner)}/items/${encodeURIComponent(
        options.credentialId
      )}/update`,
      method: 'POST',
      environment: options.environment,
      accessToken: options.accessToken,
      body: {
        f: 'json',
        apiToken1ExpirationDate: options.slot === 1 ? expirationDate.getTime() : undefined,
        apiToken2ExpirationDate: options.slot === 2 ? expirationDate.getTime() : undefined
      }
    });

    if (response.success === false) {
      throw {
        error: {
          code: 500,
          message: 'ArcGIS did not confirm the API token expiration update.'
        }
      };
    }
  }

  private async fetchCredentialsFromPath(
    path: string,
    options: FetchCredentialsOptions,
    pageSize: number,
    validator?: ResponseShapeValidator
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
      if (path === '/portals/self/apiKeys') {
        validator?.validateFirstResponse('/portals/self/apiKeys', response);
      }

      credentials.push(...this.extractCredentials(response));
      nextStart = this.readNextStart(response);
    }

    return dedupeCredentials(credentials);
  }

  private async fetchCredentialsViaSearch(
    options: FetchCredentialsOptions,
    pageSize: number,
    validator?: ResponseShapeValidator
  ): Promise<ApiKeyCredential[]> {
    const owner = await this.resolveCurrentUsername(options);
    const [newApiKeys, legacyApiKeys] = await Promise.all([
      this.fetchCredentialsFromSearchFilter(
        owner,
        NEW_API_KEYS_FILTER_SUFFIX,
        options,
        pageSize,
        validator
      ),
      this.fetchCredentialsFromSearchFilter(
        owner,
        LEGACY_API_KEYS_FILTER_SUFFIX,
        options,
        pageSize,
        validator
      )
    ]);
    return dedupeCredentials([...newApiKeys, ...legacyApiKeys]);
  }

  private async fetchCredentialsFromSearchFilter(
    owner: string,
    filterSuffix: string,
    options: FetchCredentialsOptions,
    pageSize: number,
    validator?: ResponseShapeValidator
  ): Promise<ApiKeyCredential[]> {
    const credentials: ApiKeyCredential[] = [];
    let nextStart = 1;
    const filter = `owner: ${owner} ${SEARCH_FILTER_BASE} ${filterSuffix}`;

    while (nextStart > 0) {
      const response = await this.transport.request<ArcGisPagedCredentialsResponse>({
        path: '/search',
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: {
          q: '  ',
          filter,
          start: nextStart,
          num: pageSize,
          sortField: 'modified',
          sortOrder: 'desc',
          displaySublayers: true,
          displayHighlights: true,
          displayServiceProperties: true,
          f: 'json'
        }
      });
      validator?.validateFirstResponse('/search', response);

      credentials.push(...this.extractCredentials(response));
      nextStart = this.readNextStart(response);
    }

    return credentials;
  }

  private async resolveCurrentUsername(options: FetchCredentialsOptions): Promise<string> {
    try {
      const selfResponse = await this.transport.request<CommunitySelfResponse>({
        path: '/community/self',
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });

      const username =
        readLooseString(selfResponse.username) ?? readLooseString(selfResponse.user?.username);
      if (username) {
        return username;
      }
    } catch {
      // Fall through to portal self lookup.
    }

    const portalSelf = await this.transport.request<PortalSelfResponse>({
      path: '/portals/self',
      method: 'GET',
      environment: options.environment,
      accessToken: options.accessToken,
      query: { f: 'json' }
    });

    const username = readLooseString(portalSelf.user?.username) ?? readLooseString(portalSelf.username);
    if (username) {
      return username;
    }

    throw {
      error: {
        code: 500,
        message: 'Unable to resolve ArcGIS username for API key search.'
      }
    };
  }

  private async fetchCredentialDetailForOnline(
    options: FetchCredentialDetailOptions,
    includeLegacyPayload: boolean = true,
    validator?: ResponseShapeValidator
  ): Promise<ApiKeyCredential | null> {
    const itemId = encodeURIComponent(options.credentialId);
    let itemPayload: unknown;

    try {
      itemPayload = await this.transport.request<unknown>({
        path: `/content/items/${itemId}`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });
      validator?.validateFirstResponse('/content/items', itemPayload);
    } catch {
      return null;
    }

    const itemRecord = isRecord(itemPayload) ? itemPayload : {};
    const owner = readLooseString(itemRecord.owner);

    const [registeredAppPayload, legacyPayload, groupsSnippet] = await Promise.all([
      this.fetchRegisteredAppInfo(options, owner, validator),
      includeLegacyPayload ? this.fetchLegacyCredentialDetail(options) : Promise.resolve(undefined),
      this.fetchItemGroupsSnippet(options)
    ]);

    const mergedPayload = mergeRecords(
      itemRecord,
      registeredAppPayload,
      legacyPayload,
      groupsSnippet ? { snippet: groupsSnippet } : undefined
    );
    return toCredential(mergedPayload);
  }

  private async enrichCredentialsForOnlineList(
    options: FetchCredentialsOptions,
    credentials: ApiKeyCredential[],
    validator?: ResponseShapeValidator
  ): Promise<ApiKeyCredential[]> {
    if (credentials.length === 0) {
      return credentials;
    }

    const detailById = new Map<string, ApiKeyCredential>();
    const maxConcurrent = 6;

    for (let index = 0; index < credentials.length; index += maxConcurrent) {
      const batch = credentials.slice(index, index + maxConcurrent);
      const resolved = await Promise.all(
        batch.map(async (credential) => {
          const detail = await this.fetchCredentialDetailForOnline(
            {
              environment: options.environment,
              accessToken: options.accessToken,
              credentialId: credential.id
            },
            false,
            validator
          );

          return detail ?? credential;
        })
      );

      for (const credential of resolved) {
        detailById.set(credential.id, credential);
      }
    }

    return credentials.map((credential) => detailById.get(credential.id) ?? credential);
  }

  private async fetchRegisteredAppInfo(
    options: FetchCredentialDetailOptions,
    owner: string | undefined,
    validator?: ResponseShapeValidator
  ): Promise<Record<string, unknown> | undefined> {
    if (!owner) {
      return undefined;
    }

    try {
      const response = await this.transport.request<unknown>({
        path: `/content/users/${encodeURIComponent(owner)}/items/${encodeURIComponent(
          options.credentialId
        )}/registeredAppInfo`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });
      validator?.validateFirstResponse('/content/users/items/registeredAppInfo', response);

      return isRecord(response) ? response : undefined;
    } catch {
      return undefined;
    }
  }

  private async fetchLegacyCredentialDetail(
    options: FetchCredentialDetailOptions
  ): Promise<Record<string, unknown> | undefined> {
    try {
      const response = await this.transport.request<unknown>({
        path: `/portals/self/apiKeys/${encodeURIComponent(options.credentialId)}`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });
      return isRecord(response) ? response : undefined;
    } catch {
      return undefined;
    }
  }

  private async fetchItemGroupsSnippet(options: FetchCredentialDetailOptions): Promise<string | undefined> {
    try {
      const response = await this.transport.request<ItemGroupsResponse>({
        path: `/content/items/${encodeURIComponent(options.credentialId)}/groups`,
        method: 'GET',
        environment: options.environment,
        accessToken: options.accessToken,
        query: { f: 'json' }
      });

      return readSnippetFromGroupsResponse(response);
    } catch {
      return undefined;
    }
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

function readSnippetFromGroupsResponse(response: ItemGroupsResponse): string | undefined {
  const directSnippet = readLooseString(response.snippet);
  if (directSnippet) {
    return directSnippet;
  }

  const groupRecords =
    toArray(response.groups) ?? toArray(response.results) ?? toArray(response.items) ?? [];

  for (const group of groupRecords) {
    if (!isRecord(group)) {
      continue;
    }

    const snippet = readLooseString(group.snippet);
    if (snippet) {
      return snippet;
    }
  }

  return undefined;
}

function computePartialId(
  slot: 1 | 2,
  record: Record<string, unknown>,
  source: Record<string, unknown>
): string | undefined {
  const clientId = readClientIdFromRecord(source) ?? readClientIdFromRecord(record);
  if (!clientId || clientId.length < 8) {
    return undefined;
  }

  return `AT${slot}_${clientId.slice(-8)}`;
}

function readClientIdFromRecord(source: Record<string, unknown>): string | undefined {
  const directClientId =
    readLooseString(source.client_id) ??
    readLooseString(source.clientId) ??
    readLooseString(source.clientID) ??
    readLooseString(source.clientid);
  if (directClientId) {
    return directClientId;
  }

  return findClientIdInValue(source, 0);
}

function findClientIdInValue(value: unknown, depth: number): string | undefined {
  if (!isRecord(value) || depth > 3) {
    return undefined;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key.replace(/[_-]/g, '').toLowerCase() !== 'clientid') {
      continue;
    }

    const clientId = readLooseString(nestedValue);
    if (clientId) {
      return clientId;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const nestedClientId = findClientIdInValue(nestedValue, depth + 1);
    if (nestedClientId) {
      return nestedClientId;
    }
  }

  return undefined;
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
      key2: { slot: 2, exists: false },
      isLegacy: false,
      nonExpiring: false
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

  const isLegacy = isLegacyCredential(source);
  const created = toIsoDate(
    readDateLike(source.created) ??
      readDateLike(source.createdAt) ??
      readDateLike(source.creationDate) ??
      readDateLike(source.lastModified) ??
      0
  );
  const expiration = isLegacy
    ? NON_EXPIRING_DATE_ISO
    : toIsoDate(
        readDateLike(source.expiration) ??
          readDateLike(source.expires) ??
          readDateLike(source.expiresAt) ??
          readDateLike(source.expiry) ??
          readCredentialExpirationFromTokenSlots(source) ??
          Date.now()
      );
  const key1Exists =
    readBoolean(source.key1Exists) ??
    readBoolean(readNested(source, ['key1', 'exists'])) ??
    readBoolean(readNested(source, ['apiToken1Active'])) ??
    hasUsableExpiration(readNested(source, ['apiToken1ExpirationDate'])) ??
    false;
  const key2Exists =
    readBoolean(source.key2Exists) ??
    readBoolean(readNested(source, ['key2', 'exists'])) ??
    readBoolean(readNested(source, ['apiToken2Active'])) ??
    hasUsableExpiration(readNested(source, ['apiToken2ExpirationDate'])) ??
    false;

  return {
    id,
    name: readLooseString(source.name) ?? readLooseString(source.title) ?? id,
    snippet: readLooseString(source.snippet),
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
      exists: key1Exists,
      partialId: key1Exists ? computePartialId(1, record, source) : undefined,
      created: toOptionalIsoDate(
        readDateLike(readNested(source, ['key1', 'created'])) ??
          readDateLike(readNested(source, ['apiToken1CreatedDate']))
      ),
      expiration: toOptionalIsoDate(
        readDateLike(readNested(source, ['key1', 'expiration'])) ??
          readDateLike(readNested(source, ['apiToken1ExpirationDate']))
      )
    },
    key2: {
      slot: 2,
      exists: key2Exists,
      partialId: key2Exists ? computePartialId(2, record, source) : undefined,
      created: toOptionalIsoDate(
        readDateLike(readNested(source, ['key2', 'created'])) ??
          readDateLike(readNested(source, ['apiToken2CreatedDate']))
      ),
      expiration: toOptionalIsoDate(
        readDateLike(readNested(source, ['key2', 'expiration'])) ??
          readDateLike(readNested(source, ['apiToken2ExpirationDate']))
      )
    },
    isLegacy,
    nonExpiring: isLegacy
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

function mergeRecords(...records: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const record of records) {
    if (!record) {
      continue;
    }

    for (const [key, value] of Object.entries(record)) {
      if (value === undefined || value === null) {
        continue;
      }

      const existing = merged[key];
      if (Array.isArray(existing) && Array.isArray(value)) {
        merged[key] = mergeArrayValues(existing, value);
        continue;
      }

      merged[key] = value;
    }
  }

  return merged;
}

function mergeArrayValues(existing: unknown[], incoming: unknown[]): unknown[] {
  if (incoming.length === 0) {
    return existing;
  }

  if (existing.length === 0) {
    return incoming;
  }

  if (existing.every((value) => typeof value === 'string') && incoming.every((value) => typeof value === 'string')) {
    return [...new Set([...existing, ...incoming])];
  }

  return incoming;
}

function pickValidationObject(
  response: unknown,
  objectPath: string[]
): Record<string, unknown> | undefined {
  if (objectPath.length === 0) {
    return isRecord(response) ? response : undefined;
  }

  let current: unknown = response;
  for (const segment of objectPath) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  if (Array.isArray(current)) {
    const first = current[0];
    return isRecord(first) ? first : undefined;
  }

  return isRecord(current) ? current : undefined;
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

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function hasUsableExpiration(value: unknown): boolean | undefined {
  const timestamp = readPositiveTimestamp(value);
  if (timestamp === undefined) {
    return undefined;
  }
  return timestamp > 0;
}

function readCredentialExpirationFromTokenSlots(source: Record<string, unknown>): number | undefined {
  const tokenExpirations = [
    readPositiveTimestamp(readNested(source, ['apiToken1ExpirationDate'])),
    readPositiveTimestamp(readNested(source, ['apiToken2ExpirationDate']))
  ].filter((value): value is number => typeof value === 'number');

  if (tokenExpirations.length === 0) {
    return undefined;
  }

  return Math.min(...tokenExpirations);
}

function readPositiveTimestamp(value: unknown): number | undefined {
  const dateLike = readDateLike(value);
  if (dateLike === undefined) {
    return undefined;
  }

  const parsed = typeof dateLike === 'number' ? dateLike : Number(dateLike);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function isLegacyCredential(source: Record<string, unknown>): boolean {
  const typeValue = readLooseString(source.type)?.toLowerCase();
  if (typeValue === 'api key') {
    return true;
  }

  const keywords = toStringArray(source.typeKeywords)?.map((keyword) => keyword.toLowerCase()) ?? [];
  const hasLegacyKeyword = keywords.includes('api key');
  const hasApiTokenKeyword = keywords.includes('apitoken');
  return hasLegacyKeyword && !hasApiTokenKeyword;
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

function toApiTokenExpirationDate(expirationDays: number | undefined): Date | undefined {
  if (typeof expirationDays !== 'number' || !Number.isFinite(expirationDays) || expirationDays <= 0) {
    return undefined;
  }

  const expiration = new Date();
  expiration.setDate(expiration.getDate() + expirationDays);
  expiration.setHours(23, 59, 59, 0);
  return expiration;
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
