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
