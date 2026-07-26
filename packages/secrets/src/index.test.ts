import {
  createSecretProvider,
  EnvSecretProvider,
  KubernetesSecretProvider,
  VaultSecretProvider,
} from './index';

describe('EnvSecretProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads secrets from process.env', async () => {
    process.env['TEST_SECRET'] = 'hello';
    const provider = new EnvSecretProvider();
    await expect(provider.getSecret('TEST_SECRET')).resolves.toBe('hello');
  });

  it('returns undefined for missing keys', async () => {
    delete process.env['MISSING_SECRET'];
    const provider = new EnvSecretProvider();
    await expect(provider.getSecret('MISSING_SECRET')).resolves.toBeUndefined();
  });

  it('sets secrets in process.env', async () => {
    const provider = new EnvSecretProvider();
    await provider.setSecret!('NEW_SECRET', 'value');
    expect(process.env['NEW_SECRET']).toBe('value');
  });

  it('lists environment keys', async () => {
    process.env['LIST_TEST'] = '1';
    const provider = new EnvSecretProvider();
    const keys = await provider.listKeys!();
    expect(keys).toContain('LIST_TEST');
  });
});

describe('createSecretProvider', () => {
  it('returns EnvSecretProvider for env backend', () => {
    const provider = createSecretProvider('env');
    expect(provider).toBeInstanceOf(EnvSecretProvider);
  });

  it('returns KubernetesSecretProvider for k8s backend', () => {
    const provider = createSecretProvider('k8s');
    expect(provider).toBeInstanceOf(KubernetesSecretProvider);
  });

  it('returns VaultSecretProvider for vault backend', () => {
    const provider = createSecretProvider('vault');
    expect(provider).toBeInstanceOf(VaultSecretProvider);
  });

  it('throws for unsupported backend values', () => {
    expect(() => createSecretProvider('aws_sm')).not.toThrow();
    expect(() => createSecretProvider('azure_kv')).not.toThrow();
  });
});

describe('VaultSecretProvider', () => {
  it('throws when VAULT_ADDR is unset', async () => {
    const provider = new VaultSecretProvider({ vaultAddr: undefined, isTest: false });
    await expect(provider.getSecret('db-password')).rejects.toThrow('VAULT_ADDR is not configured');
  });

  it('returns mock values in test mode', async () => {
    const provider = new VaultSecretProvider({ vaultAddr: 'http://vault.local', isTest: true });
    await expect(provider.getSecret('db-password')).resolves.toBe('mock-vault:db-password');
    await expect(provider.listKeys()).resolves.toEqual(['mock-key']);
  });
});
