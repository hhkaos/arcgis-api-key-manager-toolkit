import assert from 'node:assert/strict';
import test from 'node:test';
import { ArcGisRestClientImpl, mapRestError, type ArcGisRestRequest, type ArcGisRestTransport } from '../../src/index.js';
import type { EnvironmentConfig } from '../../src/types/models.js';

class MockTransport implements ArcGisRestTransport {
  private readonly queue: unknown[];
  public readonly calls: ArcGisRestRequest[] = [];

  public constructor(queue: unknown[]) {
    this.queue = queue;
  }

  public async request<TResponse>(request: ArcGisRestRequest): Promise<TResponse> {
    this.calls.push(request);
    const next = this.queue.shift();

    if (next instanceof Error) {
      throw next;
    }

    if (typeof next === 'function') {
      return next(request) as TResponse;
    }

    return next as TResponse;
  }
}

const onlineEnvironment: EnvironmentConfig = {
  id: 'online',
  name: 'ArcGIS Online',
  type: 'online',
  clientId: 'client-id'
};

const enterpriseEnvironment: EnvironmentConfig = {
  id: 'ent',
  name: 'Enterprise',
  type: 'enterprise',
  clientId: 'id',
  portalUrl: 'https://gis.example.com/portal'
};

test('fetchCredentials handles silent pagination', async () => {
  const transport = new MockTransport([
    {
      credentials: [
        {
          id: '1',
          name: 'first',
          tags: [],
          privileges: [],
          created: '2026-01-01T00:00:00.000Z',
          expiration: '2026-04-01T00:00:00.000Z',
          referrers: [],
          key1: { slot: 1, exists: false },
          key2: { slot: 2, exists: false }
        }
      ],
      nextStart: 2
    },
    {
      credentials: [
        {
          id: '2',
          name: 'second',
          tags: [],
          privileges: [],
          created: '2026-01-01T00:00:00.000Z',
          expiration: '2026-04-01T00:00:00.000Z',
          referrers: [],
          key1: { slot: 1, exists: false },
          key2: { slot: 2, exists: false }
        }
      ],
      nextStart: -1
    }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const results = await client.fetchCredentials({
    environment: enterpriseEnvironment,
    accessToken: 'token',
    pageSize: 1
  });

  assert.equal(results.length, 2);
  assert.equal(transport.calls.length, 2);
  assert.equal(transport.calls[0]?.path, '/portals/self/apiKeys');
  assert.equal(transport.calls[0]?.query?.start, 1);
  assert.equal(transport.calls[1]?.query?.start, 2);
});

test('fetchCredentials uses search for online and includes new + legacy API keys', async () => {
  const apiToken1ExpirationDate = 1780000000000;
  const transport = new MockTransport([
    { username: 'hhkaos2' },
    {
      results: [
        {
          id: 'new-key-item',
          title: 'New API Key',
          tags: ['maps'],
          created: 1700000000000,
          apiToken1ExpirationDate,
          apiToken2ExpirationDate: -1
        }
      ],
      nextStart: -1
    },
    {
      results: [
        {
          id: 'legacy-key-item',
          title: 'Legacy API Key',
          tags: [],
          created: 1690000000000,
          apiToken1ExpirationDate: -1,
          apiToken2ExpirationDate: -1
        }
      ],
      nextStart: -1
    }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const results = await client.fetchCredentials({
    environment: onlineEnvironment,
    accessToken: 'token',
    pageSize: 1
  });

  assert.equal(transport.calls[0]?.path, '/community/self');
  assert.equal(transport.calls[1]?.path, '/search');
  assert.equal(transport.calls[2]?.path, '/search');

  const newFilter = String(transport.calls[1]?.query?.filter ?? '');
  const legacyFilter = String(transport.calls[2]?.query?.filter ?? '');
  assert.match(newFilter, /APIToken/);
  assert.match(legacyFilter, /type:\"API Key\"/);

  const newCredential = results.find((credential) => credential.id === 'new-key-item');
  assert.ok(newCredential);
  assert.deepEqual(newCredential.tags, ['maps']);
  assert.equal(newCredential.key1.exists, true);
  assert.equal(newCredential.expiration, new Date(apiToken1ExpirationDate).toISOString());

  const legacyCredential = results.find((credential) => credential.id === 'legacy-key-item');
  assert.ok(legacyCredential);
});

test('fetchCredentials falls back to /portals/self when /community/self does not return username', async () => {
  const transport = new MockTransport([
    {},
    { user: { username: 'hhkaos2' } },
    { results: [], nextStart: -1 },
    { results: [], nextStart: -1 }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  await client.fetchCredentials({
    environment: onlineEnvironment,
    accessToken: 'token',
    pageSize: 1
  });

  assert.equal(transport.calls[0]?.path, '/community/self');
  assert.equal(transport.calls[1]?.path, '/portals/self');
  assert.equal(transport.calls[2]?.path, '/search');
  assert.equal(transport.calls[3]?.path, '/search');
});

test('fetchCredentialDetail merges item and registered app responses for online', async () => {
  const itemExpiration = 1790000000000;
  const transport = new MockTransport([
    {
      id: 'item-id',
      owner: 'hhkaos2',
      title: 'Basemap demonstrator',
      tags: ['basemaps'],
      created: 1710000000000,
      apiToken1ExpirationDate: itemExpiration,
      apiToken2ExpirationDate: -1
    },
    {
      privileges: ['premium:user:basemaps'],
      httpReferrers: ['http://127.0.0.1:5500']
    },
    {
      key1: { exists: true, partialId: 'b3169iiQ', created: 1710000000000 },
      key2: { exists: false }
    }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const credential = await client.fetchCredentialDetail({
    environment: onlineEnvironment,
    accessToken: 'token',
    credentialId: 'item-id'
  });

  assert.equal(transport.calls[0]?.path, '/content/items/item-id');
  assert.equal(transport.calls[1]?.path, '/content/users/hhkaos2/items/item-id/registeredAppInfo');
  assert.equal(transport.calls[2]?.path, '/portals/self/apiKeys/item-id');

  assert.equal(credential.id, 'item-id');
  assert.deepEqual(credential.tags, ['basemaps']);
  assert.deepEqual(credential.privileges, ['premium:user:basemaps']);
  assert.deepEqual(credential.referrers, ['http://127.0.0.1:5500']);
  assert.equal(credential.key1.exists, true);
  assert.equal(credential.key1.partialId, 'b3169iiQ');
  assert.equal(credential.expiration, new Date(itemExpiration).toISOString());
});

test('fetchCredentialDetail marks active token slots from registeredAppInfo booleans', async () => {
  const transport = new MockTransport([
    {
      id: 'item-id',
      owner: 'hhkaos2',
      title: 'Active tokens',
      tags: [''],
      created: 1710000000000,
      apiToken1ExpirationDate: -1,
      apiToken2ExpirationDate: -1
    },
    {
      apiToken1Active: true,
      apiToken2Active: false,
      privileges: []
    },
    {}
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const credential = await client.fetchCredentialDetail({
    environment: onlineEnvironment,
    accessToken: 'token',
    credentialId: 'item-id'
  });

  assert.equal(credential.key1.exists, true);
  assert.equal(credential.key2.exists, false);
  assert.deepEqual(credential.tags, []);
});

test('fetchCredentials enriches online list rows with detail metadata', async () => {
  const item1Exp = 1779110552000;
  const item2Exp = 1779439302000;
  const transport = new MockTransport([
    { username: 'hhkaos2' },
    {
      results: [
        {
          id: 'item-1',
          owner: 'hhkaos2',
          title: 'First key',
          created: 1710000000000,
          apiToken1ExpirationDate: -1,
          apiToken2ExpirationDate: -1
        }
      ],
      nextStart: -1
    },
    {
      results: [
        {
          id: 'item-2',
          owner: 'hhkaos2',
          title: 'Second key',
          created: 1720000000000,
          apiToken1ExpirationDate: -1,
          apiToken2ExpirationDate: -1
        }
      ],
      nextStart: -1
    },
    {
      id: 'item-1',
      owner: 'hhkaos2',
      title: 'First key',
      tags: ['prod'],
      apiToken1ExpirationDate: item1Exp,
      apiToken2ExpirationDate: -1
    },
    {
      id: 'item-2',
      owner: 'hhkaos2',
      title: 'Second key',
      tags: ['demo'],
      apiToken1ExpirationDate: -1,
      apiToken2ExpirationDate: item2Exp
    },
    {
      privileges: ['premium:user:basemaps'],
      httpReferrers: ['https://app.example.com'],
      apiToken1Active: true,
      apiToken2Active: false
    },
    {
      privileges: ['premium:user:geocode'],
      httpReferrers: [],
      apiToken1Active: false,
      apiToken2Active: true
    }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const credentials = await client.fetchCredentials({
    environment: onlineEnvironment,
    accessToken: 'token',
    pageSize: 10
  });

  const first = credentials.find((credential) => credential.id === 'item-1');
  assert.ok(first);
  assert.deepEqual(first.tags, ['prod']);
  assert.deepEqual(first.privileges, ['premium:user:basemaps']);
  assert.deepEqual(first.referrers, ['https://app.example.com']);
  assert.equal(first.key1.exists, true);
  assert.equal(first.key2.exists, false);
  assert.equal(first.expiration, new Date(item1Exp).toISOString());

  const second = credentials.find((credential) => credential.id === 'item-2');
  assert.ok(second);
  assert.deepEqual(second.tags, ['demo']);
  assert.deepEqual(second.privileges, ['premium:user:geocode']);
  assert.equal(second.key1.exists, false);
  assert.equal(second.key2.exists, true);
  assert.equal(second.expiration, new Date(item2Exp).toISOString());
});

test('fetchCredentials reports missing expected fields from first endpoint responses', async () => {
  const transport = new MockTransport([
    { username: 'hhkaos2' },
    {
      results: [
        {
          id: 'item-1',
          title: 'First key',
          apiToken1ExpirationDate: -1,
          apiToken2ExpirationDate: -1
        }
      ],
      nextStart: -1
    },
    { results: [], nextStart: -1 },
    {
      id: 'item-1',
      owner: 'hhkaos2',
      title: 'First key',
      apiToken1ExpirationDate: 1779110552000
    },
    {
      itemId: 'item-1',
      privileges: [],
      httpReferrers: [],
      apiToken1Active: true
    }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  await client.fetchCredentials({
    environment: onlineEnvironment,
    accessToken: 'token',
    pageSize: 10
  });

  const warnings = client.getLastResponseValidationWarnings();
  assert.ok(warnings.some((warning) => warning.includes('/search') && warning.includes('"owner"')));
  assert.ok(
    warnings.some(
      (warning) => warning.includes('/content/items') && warning.includes('"apiToken2ExpirationDate"')
    )
  );
  assert.ok(
    warnings.some(
      (warning) =>
        warning.includes('/content/users/items/registeredAppInfo') &&
        warning.includes('"apiToken2Active"')
    )
  );
});

test('fetchCredentials maps ArcGIS errors to readable rest errors', async () => {
  const transport = new MockTransport([
    {
      error: {
        code: 498,
        message: 'Invalid token'
      }
    }
  ]);

  const client = new ArcGisRestClientImpl({
    async request<TResponse>(): Promise<TResponse> {
      const response = await transport.request<Record<string, unknown>>({
        path: '',
        method: 'GET',
        environment: onlineEnvironment,
        accessToken: ''
      });
      throw response;
    }
  });

  await assert.rejects(
    () => client.fetchCredentials({ environment: enterpriseEnvironment, accessToken: 'token' }),
    (error: unknown) => {
      assert.equal(typeof error, 'object');
      assert.equal((error as { code: string }).code, 'SESSION_EXPIRED');
      return true;
    }
  );
});

test('createApiKey for online uses update + oauth2 token flow for the requested slot', async () => {
  const transport = new MockTransport([
    { owner: 'hhkaos2' },
    { client_id: 'app-client', client_secret: 'app-secret' },
    { success: true },
    { access_token: 'generated-key' }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const result = await client.createApiKey({
    environment: onlineEnvironment,
    accessToken: 'token',
    credentialId: 'item-id',
    slot: 1,
    expirationDays: 30
  });

  assert.equal(result.action, 'create');
  assert.equal(result.slot, 1);
  assert.equal(result.credentialId, 'item-id');
  assert.equal(result.key, 'generated-key');

  assert.equal(transport.calls[0]?.path, '/content/items/item-id');
  assert.equal(transport.calls[1]?.path, '/content/users/hhkaos2/items/item-id/registeredAppInfo');
  assert.equal(transport.calls[2]?.path, '/content/users/hhkaos2/items/item-id/update');
  assert.equal(transport.calls[3]?.path, '/oauth2/token');

  assert.equal(typeof transport.calls[2]?.body?.apiToken1ExpirationDate, 'number');
  assert.equal(transport.calls[2]?.body?.apiToken2ExpirationDate, undefined);
  assert.equal(transport.calls[3]?.body?.apiToken, 1);
  assert.equal(transport.calls[3]?.body?.regenerateApiToken, false);
  assert.equal(transport.calls[3]?.body?.client_id, 'app-client');
  assert.equal(transport.calls[3]?.body?.client_secret, 'app-secret');
});

test('regenerateApiKey for online sets slot-specific expiration and uses regenerate flag', async () => {
  const transport = new MockTransport([
    { owner: 'hhkaos2' },
    { client_id: 'app-client', client_secret: 'app-secret' },
    { success: true },
    { access_token: 'regenerated-key' }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const result = await client.regenerateApiKey({
    environment: onlineEnvironment,
    accessToken: 'token',
    credentialId: 'item-id',
    slot: 2,
    expirationDays: 45
  });

  assert.equal(result.action, 'regenerate');
  assert.equal(result.slot, 2);
  assert.equal(result.key, 'regenerated-key');

  assert.equal(transport.calls[2]?.path, '/content/users/hhkaos2/items/item-id/update');
  assert.equal(transport.calls[3]?.path, '/oauth2/token');
  assert.equal(transport.calls[2]?.body?.apiToken1ExpirationDate, undefined);
  assert.equal(typeof transport.calls[2]?.body?.apiToken2ExpirationDate, 'number');
  assert.equal(transport.calls[3]?.body?.apiToken, 2);
  assert.equal(transport.calls[3]?.body?.regenerateApiToken, true);
});

test('revokeApiKey for online uses oauth2 revokeToken and does not request a key value', async () => {
  const transport = new MockTransport([
    { owner: 'hhkaos2' },
    { client_id: 'app-client', client_secret: 'app-secret' },
    { success: true }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const result = await client.revokeApiKey({
    environment: onlineEnvironment,
    accessToken: 'token',
    credentialId: 'item-id',
    slot: 2
  });

  assert.equal(result.action, 'revoke');
  assert.equal(result.slot, 2);
  assert.equal(result.key, undefined);

  assert.equal(transport.calls[0]?.path, '/content/items/item-id');
  assert.equal(transport.calls[1]?.path, '/content/users/hhkaos2/items/item-id/registeredAppInfo');
  assert.equal(transport.calls.length, 3);
  assert.equal(transport.calls[2]?.path, '/oauth2/revokeToken');
  assert.equal(transport.calls[2]?.body?.apiToken, 2);
  assert.equal(transport.calls[2]?.body?.client_id, 'app-client');
  assert.equal(transport.calls[2]?.body?.client_secret, 'app-secret');
});

test('createApiKey requires expiration days and fails before update/token calls', async () => {
  const transport = new MockTransport([
    { owner: 'hhkaos2' },
    { client_id: 'app-client', client_secret: 'app-secret' }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  await assert.rejects(
    () =>
      client.createApiKey({
        environment: onlineEnvironment,
        accessToken: 'token',
        credentialId: 'item-id',
        slot: 1
      }),
    (error: unknown) => {
      assert.equal(typeof error, 'object');
      assert.equal((error as { code?: string }).code, 'INVALID_REQUEST');
      assert.equal(
        (error as { message?: string }).message,
        'Expiration date is required to generate or regenerate an API key.'
      );
      return true;
    }
  );

  assert.equal(transport.calls.length, 2);
  assert.equal(transport.calls[0]?.path, '/content/items/item-id');
  assert.equal(transport.calls[1]?.path, '/content/users/hhkaos2/items/item-id/registeredAppInfo');
});

test('online key mutation does not fall back to /portals/self key mutation endpoints', async () => {
  const transport = new MockTransport([
    { owner: 'hhkaos2' },
    { client_id: 'app-client' }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  await assert.rejects(
    () =>
      client.regenerateApiKey({
        environment: onlineEnvironment,
        accessToken: 'token',
        credentialId: 'item-id',
        slot: 1,
        expirationDays: 30
      }),
    (error: unknown) => {
      assert.equal(typeof error, 'object');
      assert.equal((error as { message?: string }).message, 'ArcGIS registered app info did not include client credentials.');
      return true;
    }
  );

  assert.equal(transport.calls.length, 2);
  assert.equal(transport.calls[0]?.path, '/content/items/item-id');
  assert.equal(transport.calls[1]?.path, '/content/users/hhkaos2/items/item-id/registeredAppInfo');
});

test('enterprise key mutation uses documented token flow endpoints', async () => {
  const transport = new MockTransport([
    { owner: 'ent-user' },
    { client_id: 'ent-client', client_secret: 'ent-secret' },
    { success: true },
    { access_token: 'enterprise-key' }
  ]);

  const client = new ArcGisRestClientImpl(transport);
  const result = await client.regenerateApiKey({
    environment: enterpriseEnvironment,
    accessToken: 'token',
    credentialId: 'item-id',
    slot: 1,
    expirationDays: 30
  });

  assert.equal(result.action, 'regenerate');
  assert.equal(result.key, 'enterprise-key');
  assert.equal(transport.calls.length, 4);
  assert.equal(transport.calls[0]?.path, '/content/items/item-id');
  assert.equal(transport.calls[1]?.path, '/content/users/ent-user/items/item-id/registeredAppInfo');
  assert.equal(transport.calls[2]?.path, '/content/users/ent-user/items/item-id/update');
  assert.equal(transport.calls[3]?.path, '/oauth2/token');
});

test('detectCapabilities gracefully degrades for unsupported enterprise version', async () => {
  const transport = new MockTransport([{ currentVersion: 11.1 }]);
  const client = new ArcGisRestClientImpl(transport);

  const capabilities = await client.detectCapabilities(enterpriseEnvironment, 'token');

  assert.equal(capabilities.canCreateApiKey, false);
  assert.equal(capabilities.canRegenerateApiKey, false);
  assert.equal(typeof capabilities.reason, 'string');
});

test('mapRestError handles network failures', () => {
  const mapped = mapRestError(new Error('network unreachable'));
  assert.equal(mapped.code, 'NETWORK_ERROR');
  assert.equal(mapped.recoverable, true);
});
