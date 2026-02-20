import type { StorageAdapter } from '../adapters/interfaces.js';
import type { EnvironmentConfig, EnvironmentType } from '../types/models.js';

export interface GroupedEnvironments {
  online: EnvironmentConfig[];
  'location-platform': EnvironmentConfig[];
  enterprise: EnvironmentConfig[];
}

export class EnvironmentManager {
  private readonly storage: StorageAdapter;
  private environments: EnvironmentConfig[] = [];
  private activeEnvironmentId: string | null = null;

  public constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  public async load(): Promise<void> {
    const [environments, activeEnvironmentId] = await Promise.all([
      this.storage.getEnvironments(),
      this.storage.getActiveEnvironmentId()
    ]);

    this.environments = environments;
    this.activeEnvironmentId = activeEnvironmentId;
  }

  public async addEnvironment(environment: EnvironmentConfig): Promise<void> {
    if (this.environments.some((item) => item.id === environment.id)) {
      throw new Error(`Environment with id "${environment.id}" already exists.`);
    }

    if (environment.type === 'enterprise' && !environment.portalUrl) {
      throw new Error('Enterprise environments must include a portal URL.');
    }

    this.environments.push(environment);
    await this.storage.setEnvironments(this.environments);
  }

  public async removeEnvironment(environmentId: string): Promise<void> {
    const nextEnvironments = this.environments.filter((item) => item.id !== environmentId);

    if (nextEnvironments.length === this.environments.length) {
      return;
    }

    this.environments = nextEnvironments;
    await this.storage.setEnvironments(this.environments);
    await this.storage.clearToken(environmentId);

    if (this.activeEnvironmentId === environmentId) {
      this.activeEnvironmentId = null;
      await this.storage.setActiveEnvironmentId(null);
    }
  }

  public listEnvironments(): GroupedEnvironments {
    return {
      online: this.groupByType('online'),
      'location-platform': this.groupByType('location-platform'),
      enterprise: this.groupByType('enterprise')
    };
  }

  public async setActiveEnvironment(environmentId: string): Promise<void> {
    const exists = this.environments.some((item) => item.id === environmentId);
    if (!exists) {
      throw new Error(`Environment with id "${environmentId}" is not configured.`);
    }

    this.activeEnvironmentId = environmentId;
    await this.storage.setActiveEnvironmentId(environmentId);
  }

  public getActiveEnvironment(): EnvironmentConfig | null {
    if (!this.activeEnvironmentId) {
      return null;
    }

    return this.environments.find((item) => item.id === this.activeEnvironmentId) ?? null;
  }

  private groupByType(type: EnvironmentType): EnvironmentConfig[] {
    return this.environments.filter((item) => item.type === type);
  }
}

