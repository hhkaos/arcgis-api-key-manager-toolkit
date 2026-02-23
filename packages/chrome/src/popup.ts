import type { EnvironmentConfig } from '@arcgis-api-keys/core';
import '@arcgis-api-keys/core/components';
import {
  CHROME_MESSAGE_SCOPE,
  type ChromeRequestMessage,
  type ChromeResponseMessage,
  type ChromeState
} from './runtime-types.js';
import {
  computePopupControlState,
  formatEnvironmentOptionLabel,
  getActiveEnvironmentFromState,
  shouldAutoOpenExplorerAfterSignIn
} from './popup-state.js';

const statusEl = requireElement<HTMLParagraphElement>('popup-status');
const disclaimerEl = requireElement<HTMLParagraphElement>('popup-disclaimer');
const acknowledgeLabelEl = requireElement<HTMLLabelElement>('popup-acknowledge-label');
const acknowledgeCheckboxEl = requireElement<HTMLInputElement>('popup-acknowledge');
const errorEl = requireElement<HTMLParagraphElement>('popup-error');
const envSelectEl = requireElement<HTMLSelectElement>('env-select');
const signInButton = requireElement<HTMLButtonElement>('sign-in');
const signOutButton = requireElement<HTMLButtonElement>('sign-out');
const openExplorerButton = requireElement<HTMLButtonElement>('open-explorer');
const addEnvForm = requireElement<HTMLFormElement>('add-env-form');
const addEnvDetailsEl = addEnvForm.closest('details');
const envTypeEl = requireElement<HTMLSelectElement>('env-type');
const envTypeMessageEl = requireElement<HTMLParagraphElement>('env-type-message');
const envNameFieldEl = requireElement<HTMLLabelElement>('env-name-field');
const envNameEl = requireElement<HTMLInputElement>('env-name');
const envClientIdFieldEl = requireElement<HTMLLabelElement>('env-client-id-field');
const envClientIdEl = requireElement<HTMLInputElement>('env-client-id');
const portalUrlFieldEl = requireElement<HTMLLabelElement>('portal-url-field');
const portalUrlEl = requireElement<HTMLInputElement>('env-portal-url');
const saveEnvButton = requireElement<HTMLButtonElement>('save-env');

let state: ChromeState = {
  environments: [],
  activeEnvironmentId: null,
  signedIn: false
};

envTypeEl.addEventListener('change', () => {
  syncEnvironmentTypeState();
});

acknowledgeCheckboxEl.addEventListener('change', () => {
  render();
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
  if (response.ok) {
    collapseAddEnvironmentPanel();
  }
});

openExplorerButton.addEventListener('click', async () => {
  await openExplorer();
});

addEnvForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  if (envTypeEl.value === 'enterprise') {
    setError(
      'ArcGIS Enterprise support is under consideration. If you need it, please add feedback in the repo issues.'
    );
    return;
  }

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
    collapseAddEnvironmentPanel();
  }
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isPushStateMessage(message)) {
    return;
  }

  void refreshState();
});

initializeWarningAcknowledgement();
void refreshState();
syncEnvironmentTypeState();

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
    option.textContent = formatEnvironmentOptionLabel(environment);
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
  disclaimerEl.hidden = !controls.showSignIn;
  acknowledgeLabelEl.hidden = !controls.showSignIn;

  signInButton.disabled = !controls.showSignIn || !isWarningAcknowledged();
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

function syncEnvironmentTypeState(): void {
  const isEnterprise = envTypeEl.value === 'enterprise';

  envTypeMessageEl.hidden = !isEnterprise;
  envNameFieldEl.hidden = isEnterprise;
  envClientIdFieldEl.hidden = isEnterprise;
  portalUrlFieldEl.hidden = true;

  envNameEl.required = !isEnterprise;
  envClientIdEl.required = !isEnterprise;
  portalUrlEl.required = false;

  saveEnvButton.hidden = isEnterprise;
  saveEnvButton.disabled = false;
}

function collapseAddEnvironmentPanel(): void {
  if (!(addEnvDetailsEl instanceof HTMLDetailsElement)) {
    return;
  }

  addEnvDetailsEl.open = false;
}

function isPushStateMessage(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const parsed = message as { scope?: string; type?: string };
  return parsed.scope === CHROME_MESSAGE_SCOPE && parsed.type === 'host/push';
}

function initializeWarningAcknowledgement(): void {
  acknowledgeCheckboxEl.checked = false;
}

function isWarningAcknowledged(): boolean {
  return acknowledgeCheckboxEl.checked;
}
