import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowSignInDisclaimer } from '../src/ui-state.js';

test('shows sign-in disclaimer only while logged out', () => {
  assert.equal(shouldShowSignInDisclaimer('logged-out'), true);
  assert.equal(shouldShowSignInDisclaimer('checking'), false);
  assert.equal(shouldShowSignInDisclaimer('logging-in'), false);
  assert.equal(shouldShowSignInDisclaimer('logged-in'), false);
  assert.equal(shouldShowSignInDisclaimer('logging-out'), false);
});
