import type { AuthToken, EnvironmentConfig } from '../types/models.js';

export interface StorageAdapter {
  getEnvironments(): Promise<EnvironmentConfig[]>;
  setEnvironments(environments: EnvironmentConfig[]): Promise<void>;
  getActiveEnvironmentId(): Promise<string | null>;
  setActiveEnvironmentId(environmentId: string | null): Promise<void>;
  getToken(environmentId: string): Promise<AuthToken | null>;
  setToken(environmentId: string, token: AuthToken): Promise<void>;
  clearToken(environmentId: string): Promise<void>;
}

export interface AuthAdapter {
  signIn(environment: EnvironmentConfig): Promise<AuthToken>;
  signOut(environment: EnvironmentConfig): Promise<void>;
}

export interface ClipboardAdapter {
  copy(text: string): Promise<void>;
}

