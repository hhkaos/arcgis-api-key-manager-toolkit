import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computePopupControlState,
  shouldAutoOpenExplorerAfterSignIn,
  shouldShowEnterprisePortalField,
  type PopupControlState
} from '../src/popup-state.js';
import type { ChromeResponseMessage, ChromeState } from '../src/runtime-types.js';

function createState(overrides: Partial<ChromeState> = {}): ChromeState {
  return {
    environments: [
      {
        id: 'online-1',
        name: 'ArcGIS Online Dev',
        type: 'online',
        clientId: 'abc'
      }
    ],
    activeEnvironmentId: 'online-1',
    signedIn: false,
    ...overrides
  };
}

function assertControls(actual: PopupControlState, expected: PopupControlState): void {
  assert.deepEqual(actual, expected);
}

test('shows only Sign In when active environment is signed out', () => {
  const controls = computePopupControlState(createState({ signedIn: false }));

  assertControls(controls, {
    hasActiveEnvironment: true,
    showSignIn: true,
    showSignOut: false,
    showOpenExplorer: false
  });
});

test('shows Sign Out and Open Explorer when active environment is signed in', () => {
  const controls = computePopupControlState(createState({ signedIn: true }));

  assertControls(controls, {
    hasActiveEnvironment: true,
    showSignIn: false,
    showSignOut: true,
    showOpenExplorer: true
  });
});

test('hides all auth/explorer controls when no active environment exists', () => {
  const controls = computePopupControlState(createState({ activeEnvironmentId: null }));

  assertControls(controls, {
    hasActiveEnvironment: false,
    showSignIn: false,
    showSignOut: false,
    showOpenExplorer: false
  });
});

test('auto-opens explorer only after successful signed-in response', () => {
  const okSignedIn: ChromeResponseMessage = {
    ok: true,
    state: createState({ signedIn: true })
  };
  const okSignedOut: ChromeResponseMessage = {
    ok: true,
    state: createState({ signedIn: false })
  };
  const notOk: ChromeResponseMessage = {
    ok: false,
    error: 'failed'
  };

  assert.equal(shouldAutoOpenExplorerAfterSignIn(okSignedIn), true);
  assert.equal(shouldAutoOpenExplorerAfterSignIn(okSignedOut), false);
  assert.equal(shouldAutoOpenExplorerAfterSignIn(notOk), false);
});

test('enterprise portal field visibility toggles only for enterprise type', () => {
  assert.equal(shouldShowEnterprisePortalField('enterprise'), true);
  assert.equal(shouldShowEnterprisePortalField('online'), false);
  assert.equal(shouldShowEnterprisePortalField('location-platform'), false);
});
