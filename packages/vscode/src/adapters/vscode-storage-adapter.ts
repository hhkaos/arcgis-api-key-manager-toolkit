import type { AuthToken, EnvironmentConfig, StorageAdapter } from '@arcgis-api-keys/core';
import type * as vscode from 'vscode';

const ENVIRONMENTS_KEY = 'arcgis-api-keys.environments';
const ACTIVE_ENVIRONMENT_KEY = 'arcgis-api-keys.active-environment-id';
const TOKEN_SECRET_KEY_PREFIX = 'arcgis-api-keys.token';

export class VscodeStorageAdapter implements StorageAdapter {
  private readonly context: vscode.ExtensionContext;

  public constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public async getEnvironments(): Promise<EnvironmentConfig[]> {
    return this.context.globalState.get<EnvironmentConfig[]>(ENVIRONMENTS_KEY, []);
  }

  public async setEnvironments(environments: EnvironmentConfig[]): Promise<void> {
    await this.context.globalState.update(ENVIRONMENTS_KEY, environments);
  }

  public async getActiveEnvironmentId(): Promise<string | null> {
    return this.context.globalState.get<string | null>(ACTIVE_ENVIRONMENT_KEY, null);
  }

  public async setActiveEnvironmentId(environmentId: string | null): Promise<void> {
    await this.context.globalState.update(ACTIVE_ENVIRONMENT_KEY, environmentId);
  }

  public async getToken(environmentId: string): Promise<AuthToken | null> {
    const raw = await this.context.secrets.get(this.getTokenSecretKey(environmentId));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as AuthToken;
      if (!parsed.accessToken || !parsed.expiresAt) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  public async setToken(environmentId: string, token: AuthToken): Promise<void> {
    await this.context.secrets.store(this.getTokenSecretKey(environmentId), JSON.stringify(token));
  }

  public async clearToken(environmentId: string): Promise<void> {
    await this.context.secrets.delete(this.getTokenSecretKey(environmentId));
  }

  private getTokenSecretKey(environmentId: string): string {
    return `${TOKEN_SECRET_KEY_PREFIX}.${environmentId}`;
  }
}
