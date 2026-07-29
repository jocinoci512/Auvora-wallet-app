import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface SecretProviderPort {
  getSecret(key: string): Promise<string | undefined>;
  setSecret?(key: string, value: string): Promise<void>;
  listKeys?(): Promise<string[]>;
}

export type SecretBackend = 'env' | 'k8s' | 'vault' | 'aws_sm' | 'azure_kv';

const DEFAULT_K8S_SECRETS_PATH = '/var/run/secrets/auvora';

export class EnvSecretProvider implements SecretProviderPort {
  async getSecret(key: string): Promise<string | undefined> {
    const value = process.env[key];
    return value === undefined || value === '' ? undefined : value;
  }

  async setSecret(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }

  async listKeys(): Promise<string[]> {
    return Object.keys(process.env).sort();
  }
}

export class KubernetesSecretProvider implements SecretProviderPort {
  constructor(
    private readonly basePath = process.env['K8S_SECRETS_PATH'] ?? DEFAULT_K8S_SECRETS_PATH,
  ) {}

  async getSecret(key: string): Promise<string | undefined> {
    const filePath = join(this.basePath, key);
    if (!existsSync(filePath)) {
      return undefined;
    }
    const value = readFileSync(filePath, 'utf8').trim();
    return value === '' ? undefined : value;
  }

  async listKeys(): Promise<string[]> {
    if (!existsSync(this.basePath)) {
      return [];
    }
    return readdirSync(this.basePath).sort();
  }
}

export class VaultSecretProvider implements SecretProviderPort {
  private readonly vaultAddr: string | undefined;
  private readonly isTest: boolean;

  constructor(options?: { vaultAddr?: string; isTest?: boolean }) {
    this.vaultAddr = options?.vaultAddr ?? process.env['VAULT_ADDR'];
    this.isTest = options?.isTest ?? process.env['NODE_ENV'] === 'test';
  }

  private assertConfigured(): void {
    if (!this.vaultAddr) {
      throw new Error('VAULT_ADDR is not configured');
    }
  }

  async getSecret(key: string): Promise<string | undefined> {
    if (!this.vaultAddr) {
      throw new Error('VAULT_ADDR is not configured');
    }
    if (this.isTest) {
      return `mock-vault:${key}`;
    }
    throw new Error('VaultSecretProvider HTTP client is not implemented');
  }

  async setSecret(key: string, value: string): Promise<void> {
    this.assertConfigured();
    if (this.isTest) {
      return;
    }
    throw new Error(
      `VaultSecretProvider HTTP client is not implemented (key=${key}, len=${value.length})`,
    );
  }

  async listKeys(): Promise<string[]> {
    this.assertConfigured();
    if (this.isTest) {
      return ['mock-key'];
    }
    throw new Error('VaultSecretProvider HTTP client is not implemented');
  }
}

class AwsSecretsManagerProvider implements SecretProviderPort {
  async getSecret(_key: string): Promise<string | undefined> {
    throw new Error('AWS Secrets Manager provider is not implemented');
  }
}

class AzureKeyVaultProvider implements SecretProviderPort {
  async getSecret(_key: string): Promise<string | undefined> {
    throw new Error('Azure Key Vault provider is not implemented');
  }
}

export function createSecretProvider(backend: SecretBackend): SecretProviderPort {
  switch (backend) {
    case 'env':
      return new EnvSecretProvider();
    case 'k8s':
      return new KubernetesSecretProvider();
    case 'vault':
      return new VaultSecretProvider();
    case 'aws_sm':
      return new AwsSecretsManagerProvider();
    case 'azure_kv':
      return new AzureKeyVaultProvider();
    default: {
      const exhaustive: never = backend;
      throw new Error(`Unsupported secret backend: ${String(exhaustive)}`);
    }
  }
}
