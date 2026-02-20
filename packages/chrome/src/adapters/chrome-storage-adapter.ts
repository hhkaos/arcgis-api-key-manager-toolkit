import type { AuthToken, EnvironmentConfig, StorageAdapter } from '@arcgis-api-keys/core';

const ENVIRONMENTS_KEY = 'arcgis-api-keys.environments';
const ACTIVE_ENVIRONMENT_KEY = 'arcgis-api-keys.active-environment-id';
const TOKENS_KEY = 'arcgis-api-keys.tokens';

interface SessionState {
  [ENVIRONMENTS_KEY]?: EnvironmentConfig[];
  [ACTIVE_ENVIRONMENT_KEY]?: string | null;
  [TOKENS_KEY]?: Record<string, AuthToken>;
}

export class ChromeStorageAdapter implements StorageAdapter {
  public async getEnvironments(): Promise<EnvironmentConfig[]> {
    const state = await this.readState();
    return state[ENVIRONMENTS_KEY] ?? [];
  }

  public async setEnvironments(environments: EnvironmentConfig[]): Promise<void> {
    await chrome.storage.session.set({ [ENVIRONMENTS_KEY]: environments });
  }

  public async getActiveEnvironmentId(): Promise<string | null> {
    const state = await this.readState();
    return state[ACTIVE_ENVIRONMENT_KEY] ?? null;
  }

  public async setActiveEnvironmentId(environmentId: string | null): Promise<void> {
    await chrome.storage.session.set({ [ACTIVE_ENVIRONMENT_KEY]: environmentId });
  }

  public async getToken(environmentId: string): Promise<AuthToken | null> {
    const state = await this.readState();
    const tokens = state[TOKENS_KEY] ?? {};
    return tokens[environmentId] ?? null;
  }

  public async setToken(environmentId: string, token: AuthToken): Promise<void> {
    const state = await this.readState();
    const tokens = state[TOKENS_KEY] ?? {};
    tokens[environmentId] = token;
    await chrome.storage.session.set({ [TOKENS_KEY]: tokens });
  }

  public async clearToken(environmentId: string): Promise<void> {
    const state = await this.readState();
    const tokens = state[TOKENS_KEY] ?? {};
    delete tokens[environmentId];
    await chrome.storage.session.set({ [TOKENS_KEY]: tokens });
  }

  private async readState(): Promise<SessionState> {
    return (await chrome.storage.session.get([
      ENVIRONMENTS_KEY,
      ACTIVE_ENVIRONMENT_KEY,
      TOKENS_KEY
    ])) as SessionState;
  }
}
