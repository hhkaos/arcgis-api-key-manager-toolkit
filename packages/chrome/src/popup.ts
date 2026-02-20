import type { EnvironmentConfig } from '@arcgis-api-keys/core';
import {
  CHROME_MESSAGE_SCOPE,
  type ChromeRequestMessage,
  type ChromeResponseMessage,
  type ChromeState
} from './runtime-types.js';
import {
  computePopupControlState,
  getActiveEnvironmentFromState,
  shouldAutoOpenExplorerAfterSignIn,
  shouldShowEnterprisePortalField
} from './popup-state.js';

const statusEl = requireElement<HTMLParagraphElement>('popup-status');
const errorEl = requireElement<HTMLParagraphElement>('popup-error');
const envSelectEl = requireElement<HTMLSelectElement>('env-select');
const signInButton = requireElement<HTMLButtonElement>('sign-in');
const signOutButton = requireElement<HTMLButtonElement>('sign-out');
const openExplorerButton = requireElement<HTMLButtonElement>('open-explorer');
const addEnvForm = requireElement<HTMLFormElement>('add-env-form');
const envTypeEl = requireElement<HTMLSelectElement>('env-type');
const envNameEl = requireElement<HTMLInputElement>('env-name');
const envClientIdEl = requireElement<HTMLInputElement>('env-client-id');
const portalUrlFieldEl = requireElement<HTMLLabelElement>('portal-url-field');
const portalUrlEl = requireElement<HTMLInputElement>('env-portal-url');

let state: ChromeState = {
  environments: [],
  activeEnvironmentId: null,
  signedIn: false
};

envTypeEl.addEventListener('change', () => {
  syncPortalFieldVisibility();
});

signInButton.addEventListener('click', async () => {
  const active = getActiveEnvironment();
  if (!active) {
    setError('Add an environment first.');
    return;
  }

  const response = await request({
    scope: CHROME_MESSAGE_SCOPE,
    type: 'popup/sign-in',
    payload: { environmentId: active.id }
  });

  handleStateResponse(response);

  if (shouldAutoOpenExplorerAfterSignIn(response)) {
    await openExplorer();
  }
});

signOutButton.addEventListener('click', async () => {
  const active = getActiveEnvironment();
  if (!active) {
    return;
  }

  const response = await request({
    scope: CHROME_MESSAGE_SCOPE,
    type: 'popup/sign-out',
    payload: { environmentId: active.id }
  });

  handleStateResponse(response);
});

envSelectEl.addEventListener('change', async () => {
  const environmentId = envSelectEl.value;
  if (!environmentId) {
    return;
  }

  const response = await request({
    scope: CHROME_MESSAGE_SCOPE,
    type: 'popup/select-environment',
    payload: { environmentId }
  });

  handleStateResponse(response);
});

openExplorerButton.addEventListener('click', async () => {
  await openExplorer();
});

addEnvForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload: Extract<ChromeRequestMessage, { type: 'popup/add-environment' }>['payload'] = {
    type: envTypeEl.value as EnvironmentConfig['type'],
    name: envNameEl.value,
    clientId: envClientIdEl.value,
    portalUrl: portalUrlEl.value || undefined
  };

  const response = await request({
    scope: CHROME_MESSAGE_SCOPE,
    type: 'popup/add-environment',
    payload
  });

  handleStateResponse(response);

  if (response.ok) {
    envNameEl.value = '';
    envClientIdEl.value = '';
    portalUrlEl.value = '';
  }
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isPushStateMessage(message)) {
    return;
  }

  void refreshState();
});

void refreshState();
syncPortalFieldVisibility();

async function refreshState(): Promise<void> {
  const response = await request({
    scope: CHROME_MESSAGE_SCOPE,
    type: 'popup/get-state'
  });

  handleStateResponse(response);
}

function handleStateResponse(response: ChromeResponseMessage): void {
  if (!response.ok) {
    setError(response.error);
    return;
  }

  clearError();

  if (response.state) {
    state = response.state;
  }

  render();
}

function render(): void {
  const currentValue = state.activeEnvironmentId ?? '';

  envSelectEl.replaceChildren();
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = state.environments.length > 0 ? 'Select environment' : 'No environments';
  envSelectEl.append(placeholderOption);

  for (const environment of state.environments) {
    const option = document.createElement('option');
    option.value = environment.id;
    option.textContent = environment.name;
    envSelectEl.append(option);
  }

  envSelectEl.value = currentValue;

  const active = getActiveEnvironment();
  const controls = computePopupControlState(state);
  statusEl.textContent = active
    ? `${state.signedIn ? 'Signed in' : 'Not signed in'} to ${active.name}.`
    : 'No environment configured.';

  signInButton.hidden = !controls.showSignIn;
  signOutButton.hidden = !controls.showSignOut;
  openExplorerButton.hidden = !controls.showOpenExplorer;

  signInButton.disabled = !controls.showSignIn;
  signOutButton.disabled = !controls.showSignOut;
  openExplorerButton.disabled = !controls.showOpenExplorer;
}

function getActiveEnvironment(): EnvironmentConfig | null {
  return getActiveEnvironmentFromState(state);
}

async function request(message: ChromeRequestMessage): Promise<ChromeResponseMessage> {
  try {
    return (await chrome.runtime.sendMessage(message)) as ChromeResponseMessage;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to communicate with service worker.'
    };
  }
}

function requireElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }

  return element as TElement;
}

function setError(message: string): void {
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function clearError(): void {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

async function openExplorer(): Promise<void> {
  await chrome.tabs.create({
    url: chrome.runtime.getURL('explorer.html')
  });
}

function syncPortalFieldVisibility(): void {
  const isEnterprise = shouldShowEnterprisePortalField(envTypeEl.value);
  portalUrlFieldEl.hidden = !isEnterprise;
  portalUrlEl.required = isEnterprise;
}

function isPushStateMessage(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const parsed = message as { scope?: string; type?: string };
  return parsed.scope === CHROME_MESSAGE_SCOPE && parsed.type === 'host/push';
}
