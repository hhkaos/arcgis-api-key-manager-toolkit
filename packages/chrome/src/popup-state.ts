import type { EnvironmentConfig } from '@arcgis-api-keys/core';
import type { ChromeResponseMessage, ChromeState } from './runtime-types.js';

export interface PopupControlState {
  hasActiveEnvironment: boolean;
  showSignIn: boolean;
  showSignOut: boolean;
  showOpenExplorer: boolean;
}

export function getActiveEnvironmentFromState(state: ChromeState): EnvironmentConfig | null {
  if (!state.activeEnvironmentId) {
    return null;
  }

  return state.environments.find((environment) => environment.id === state.activeEnvironmentId) ?? null;
}

export function computePopupControlState(state: ChromeState): PopupControlState {
  const activeEnvironment = getActiveEnvironmentFromState(state);
  const hasActiveEnvironment = Boolean(activeEnvironment);
  const isSignedIn = hasActiveEnvironment && state.signedIn;

  return {
    hasActiveEnvironment,
    showSignIn: hasActiveEnvironment && !isSignedIn,
    showSignOut: isSignedIn,
    showOpenExplorer: isSignedIn
  };
}

export function shouldAutoOpenExplorerAfterSignIn(response: ChromeResponseMessage): boolean {
  return Boolean(response.ok && response.state?.signedIn);
}

export function shouldShowEnterprisePortalField(environmentType: string): boolean {
  return environmentType === 'enterprise';
}

export function formatEnvironmentTypeLabel(environmentType: EnvironmentConfig['type']): string {
  if (environmentType === 'online') {
    return 'ArcGIS Online';
  }

  if (environmentType === 'location-platform') {
    return 'ArcGIS Location Platform';
  }

  return 'ArcGIS Enterprise';
}

export function formatEnvironmentOptionLabel(environment: EnvironmentConfig): string {
  return `${environment.name} (${formatEnvironmentTypeLabel(environment.type)})`;
}
