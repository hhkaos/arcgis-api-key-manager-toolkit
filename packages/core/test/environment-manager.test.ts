import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentManager, type AuthToken, type EnvironmentConfig, type StorageAdapter } from '../src/index.js';

class InMemoryStorageAdapter implements StorageAdapter {
  private environments: EnvironmentConfig[] = [];
  private activeEnvironmentId: string | null = null;
  private tokenByEnvironmentId = new Map<string, AuthToken>();

  public async getEnvironments(): Promise<EnvironmentConfig[]> {
    return this.environments;
  }

  public async setEnvironments(environments: EnvironmentConfig[]): Promise<void> {
    this.environments = environments;
  }

  public async getActiveEnvironmentId(): Promise<string | null> {
    return this.activeEnvironmentId;
  }

  public async setActiveEnvironmentId(environmentId: string | null): Promise<void> {
    this.activeEnvironmentId = environmentId;
  }

  public async getToken(environmentId: string): Promise<AuthToken | null> {
    return this.tokenByEnvironmentId.get(environmentId) ?? null;
  }

  public async setToken(environmentId: string, token: AuthToken): Promise<void> {
    this.tokenByEnvironmentId.set(environmentId, token);
  }

  public async clearToken(environmentId: string): Promise<void> {
    this.tokenByEnvironmentId.delete(environmentId);
  }
}

test('EnvironmentManager add/remove/switch lifecycle', async () => {
  const storage = new InMemoryStorageAdapter();
  const manager = new EnvironmentManager(storage);

  await manager.load();
  await manager.addEnvironment({
    id: 'online-dev',
    name: 'ArcGIS Online Dev',
    type: 'online',
    clientId: 'abc123'
  });
  await manager.addEnvironment({
    id: 'ent-prod',
    name: 'Enterprise Prod',
    type: 'enterprise',
    clientId: 'xyz789',
    portalUrl: 'https://gis.example.com/portal'
  });
  await manager.setActiveEnvironment('online-dev');

  assert.equal(manager.getActiveEnvironment()?.id, 'online-dev');
  assert.equal(manager.listEnvironments().online.length, 1);
  assert.equal(manager.listEnvironments().enterprise.length, 1);

  await manager.removeEnvironment('online-dev');
  assert.equal(manager.getActiveEnvironment(), null);
  assert.equal(manager.listEnvironments().online.length, 0);
});

