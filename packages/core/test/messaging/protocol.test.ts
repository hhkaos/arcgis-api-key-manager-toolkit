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
