import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deserializeMessage,
  serializeMessage,
  toHostErrorPayload,
  type WebviewProtocolMessage
} from '../../src/index.js';

test('serializeMessage + deserializeMessage roundtrip', () => {
  const message: WebviewProtocolMessage = {
    type: 'webview/load-credentials',
    requestId: 'req-1',
    payload: { refresh: true }
  };

  const serialized = serializeMessage(message);
  const parsed = deserializeMessage(serialized);

  assert.deepEqual(parsed, message);
});

test('serializeMessage + deserializeMessage supports key revoke action payloads', () => {
  const request: WebviewProtocolMessage = {
    type: 'webview/key-action',
    requestId: 'req-key-action',
    payload: {
      credentialId: 'item-id',
      slot: 2,
      action: 'revoke'
    }
  };
  const requestRoundTrip = deserializeMessage(serializeMessage(request));
  assert.deepEqual(requestRoundTrip, request);

  const response: WebviewProtocolMessage = {
    type: 'host/key-action-result',
    requestId: 'req-key-action',
    payload: {
      result: {
        action: 'revoke',
        slot: 2,
        credentialId: 'item-id'
      }
    }
  };
  const responseRoundTrip = deserializeMessage(serializeMessage(response));
  assert.deepEqual(responseRoundTrip, response);
});

test('serializeMessage + deserializeMessage supports open external URL payloads', () => {
  const message: WebviewProtocolMessage = {
    type: 'webview/open-external-url',
    requestId: 'req-open-url',
    payload: {
      url: 'https://acme.maps.arcgis.com/home/item.html?id=item-id#settings'
    }
  };

  const roundTrip = deserializeMessage(serializeMessage(message));
  assert.deepEqual(roundTrip, message);
});

test('serializeMessage + deserializeMessage supports referrer update payloads', () => {
  const message: WebviewProtocolMessage = {
    type: 'webview/update-credential-referrers',
    requestId: 'req-referrer-update',
    payload: {
      credentialId: 'item-id',
      referrers: ['https://cdpn.io/', 'http://localhost:5173/']
    }
  };

  const roundTrip = deserializeMessage(serializeMessage(message));
  assert.deepEqual(roundTrip, message);
});

test('serializeMessage + deserializeMessage supports delete and favorite payloads', () => {
  const favoriteMessage: WebviewProtocolMessage = {
    type: 'webview/toggle-credential-favorite',
    requestId: 'req-favorite',
    payload: {
      credentialId: 'item-id',
      favorite: true
    }
  };
  assert.deepEqual(deserializeMessage(serializeMessage(favoriteMessage)), favoriteMessage);

  const deleteCheckResult: WebviewProtocolMessage = {
    type: 'host/credential-delete-check-result',
    requestId: 'req-delete-check',
    payload: {
      credentialId: 'item-id',
      canDelete: false
    }
  };
  assert.deepEqual(deserializeMessage(serializeMessage(deleteCheckResult)), deleteCheckResult);
});

test('deserializeMessage rejects invalid messages', () => {
  assert.throws(() => deserializeMessage('{"type":"unknown","payload":{}}'));
  assert.throws(() => deserializeMessage('{"type":"webview/sign-in","payload":"bad"}'));
});

test('toHostErrorPayload maps rest errors to protocol payload', () => {
  const payload = toHostErrorPayload({
    code: 'SESSION_EXPIRED',
    message: 'Session expired. Sign in again to continue.',
    recoverable: true
  });

  assert.deepEqual(payload, {
    code: 'SESSION_EXPIRED',
    message: 'Session expired. Sign in again to continue.',
    recoverable: true
  });
});
