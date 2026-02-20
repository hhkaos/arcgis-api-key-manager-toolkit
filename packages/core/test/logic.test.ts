import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeReferrers,
  categorizeExpiration,
  filterCredentials,
  sortCredentials,
  type ApiKeyCredential
} from '../src/index.js';

const now = new Date('2026-02-20T00:00:00.000Z');

const credentials: ApiKeyCredential[] = [
  {
    id: 'b',
    name: 'Routing Sandbox',
    tags: ['dev'],
    privileges: ['routing', 'basemaps'],
    created: '2026-01-01T00:00:00.000Z',
    expiration: '2026-03-01T00:00:00.000Z',
    referrers: ['https://dev.example.com'],
    key1: { slot: 1, exists: true },
    key2: { slot: 2, exists: false }
  },
  {
    id: 'a',
    name: 'Prod Geocoder',
    tags: ['prod'],
    privileges: ['geocoding'],
    created: '2025-12-01T00:00:00.000Z',
    expiration: '2026-02-22T00:00:00.000Z',
    referrers: ['*'],
    key1: { slot: 1, exists: true },
    key2: { slot: 2, exists: true }
  }
];

test('categorizeExpiration matches v1 thresholds', () => {
  assert.equal(categorizeExpiration('2026-04-01T00:00:00.000Z', now), 'ok');
  assert.equal(categorizeExpiration('2026-02-27T00:00:00.000Z', now), 'warning');
  assert.equal(categorizeExpiration('2026-02-25T00:00:00.000Z', now), 'critical');
  assert.equal(categorizeExpiration('2026-02-19T00:00:00.000Z', now), 'expired');
});

test('filterCredentials supports search/tag/privilege', () => {
  assert.equal(filterCredentials(credentials, { search: 'prod' }).length, 1);
  assert.equal(filterCredentials(credentials, { tag: 'dev' })[0]?.id, 'b');
  assert.equal(filterCredentials(credentials, { privilege: 'routing' })[0]?.id, 'b');
});

test('sortCredentials supports name/expiration/created', () => {
  assert.deepEqual(
    sortCredentials(credentials, { field: 'name', direction: 'asc' }).map((item) => item.id),
    ['a', 'b']
  );
  assert.deepEqual(
    sortCredentials(credentials, { field: 'expiration', direction: 'asc' }).map((item) => item.id),
    ['a', 'b']
  );
  assert.deepEqual(
    sortCredentials(credentials, { field: 'created', direction: 'desc' }).map((item) => item.id),
    ['b', 'a']
  );
});

test('analyzeReferrers flags permissive patterns', () => {
  const results = analyzeReferrers(['*', 'http://plain-http.example.com', 'https://safe.example.com']);
  assert.equal(results[0]?.reason, 'wildcard-only');
  assert.equal(results[1]?.reason, 'permissive-pattern');
  assert.equal(results[2]?.warning, false);
});

