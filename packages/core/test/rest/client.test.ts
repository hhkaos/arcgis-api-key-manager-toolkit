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
    environment: onlineEnvironment,
    accessToken: 'token',
    pageSize: 1
  });

  assert.equal(results.length, 2);
  assert.equal(transport.calls.length, 2);
  assert.equal(transport.calls[0]?.query?.start, 1);
  assert.equal(transport.calls[1]?.query?.start, 2);
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
    () => client.fetchCredentials({ environment: onlineEnvironment, accessToken: 'token' }),
    (error: unknown) => {
      assert.equal(typeof error, 'object');
      assert.equal((error as { code: string }).code, 'SESSION_EXPIRED');
      return true;
    }
  );
});

test('detectCapabilities gracefully degrades for unsupported enterprise version', async () => {
  const transport = new MockTransport([{ currentVersion: 11.1 }]);
  const client = new ArcGisRestClientImpl(transport);

  const capabilities = await client.detectCapabilities(
    {
      id: 'ent',
      name: 'Enterprise',
      type: 'enterprise',
      clientId: 'id',
      portalUrl: 'https://gis.example.com/portal'
    },
    'token'
  );

  assert.equal(capabilities.canCreateApiKey, false);
  assert.equal(capabilities.canRegenerateApiKey, false);
  assert.equal(typeof capabilities.reason, 'string');
});

test('mapRestError handles network failures', () => {
  const mapped = mapRestError(new Error('network unreachable'));
  assert.equal(mapped.code, 'NETWORK_ERROR');
  assert.equal(mapped.recoverable, true);
});
