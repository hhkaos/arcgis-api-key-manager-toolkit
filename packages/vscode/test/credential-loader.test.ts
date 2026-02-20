import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCredentialLoadMessage } from '../src/flows/credential-loader.js';
import type { ApiKeyCredential } from '@arcgis-api-keys/core';

const baseCredential: ApiKeyCredential = {
  id: 'a',
  name: 'A',
  tags: [],
  privileges: [],
  created: '2026-01-01T00:00:00.000Z',
  expiration: '2026-12-01T00:00:00.000Z',
  referrers: [],
  key1: { slot: 1, exists: false },
  key2: { slot: 2, exists: false }
};

test('passes raw access token string into fetchCredentials', async () => {
  let receivedToken: string | null = null;

  const message = await buildCredentialLoadMessage({
    token: {
      accessToken: 'abc-token',
      expiresAt: Date.now() + 60_000,
      tokenType: 'Bearer'
    },
    fetchCredentials: async (accessToken) => {
      receivedToken = accessToken;
      return [baseCredential];
    }
  });

  assert.equal(receivedToken, 'abc-token');
  assert.equal(message.type, 'host/credentials');
});

test('returns session error when token is missing', async () => {
  const message = await buildCredentialLoadMessage({
    token: null,
    fetchCredentials: async () => [baseCredential]
  });

  assert.equal(message.type, 'host/error');
  assert.equal(message.payload.code, 'SESSION_EXPIRED');
});

test('returns session error when token is expired', async () => {
  const now = Date.now();

  const message = await buildCredentialLoadMessage({
    token: {
      accessToken: 'expired',
      expiresAt: now - 1,
      tokenType: 'Bearer'
    },
    fetchCredentials: async () => [baseCredential],
    nowMs: now
  });

  assert.equal(message.type, 'host/error');
  assert.equal(message.payload.code, 'SESSION_EXPIRED');
});

test('sorts credentials by created desc by default', async () => {
  const older: ApiKeyCredential = {
    ...baseCredential,
    id: 'older',
    created: '2020-01-01T00:00:00.000Z'
  };
  const newer: ApiKeyCredential = {
    ...baseCredential,
    id: 'newer',
    created: '2025-01-01T00:00:00.000Z'
  };

  const message = await buildCredentialLoadMessage({
    token: {
      accessToken: 'ok',
      expiresAt: Date.now() + 60_000,
      tokenType: 'Bearer'
    },
    fetchCredentials: async () => [older, newer]
  });

  assert.equal(message.type, 'host/credentials');
  assert.deepEqual(message.payload.credentials.map((credential) => credential.id), ['newer', 'older']);
});
