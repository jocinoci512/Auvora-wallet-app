import { createHash, randomBytes } from 'node:crypto';
import {
  AssetStandard,
  ChainNetwork,
  PrismaClient,
  UserStatus,
} from '../generated/client';

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ code: string; description: string }> = [
  { code: 'users:read', description: 'Read users' },
  { code: 'users:write', description: 'Create and update users' },
  { code: 'users:delete', description: 'Soft-delete and restore users' },
  { code: 'roles:manage', description: 'Assign roles and permissions' },
  { code: 'audit:read', description: 'Read security audit logs' },
  { code: 'sessions:revoke', description: 'Force-revoke user sessions' },
  { code: 'wallets:read', description: 'Read wallets' },
  { code: 'wallets:write', description: 'Create and update wallets' },
  { code: 'wallets:admin', description: 'Administer all wallets' },
  { code: 'wallets:suspend', description: 'Suspend wallets' },
  { code: 'wallets:archive', description: 'Archive wallets' },
];

const USER_WALLET_PERMISSION_CODES = ['wallets:read', 'wallets:write'] as const;

const NATIVE_ASSETS: Array<{
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  chain: ChainNetwork;
}> = [
  { code: 'BTC', name: 'Bitcoin', symbol: 'BTC', decimals: 8, chain: ChainNetwork.BITCOIN },
  { code: 'ETH', name: 'Ethereum', symbol: 'ETH', decimals: 18, chain: ChainNetwork.ETHEREUM },
  { code: 'MATIC', name: 'Polygon', symbol: 'MATIC', decimals: 18, chain: ChainNetwork.POLYGON },
  { code: 'SOL', name: 'Solana', symbol: 'SOL', decimals: 9, chain: ChainNetwork.SOLANA },
  { code: 'BNB', name: 'BNB', symbol: 'BNB', decimals: 18, chain: ChainNetwork.BNB_SMART_CHAIN },
  { code: 'TRX', name: 'TRON', symbol: 'TRX', decimals: 6, chain: ChainNetwork.TRON },
  { code: 'LTC', name: 'Litecoin', symbol: 'LTC', decimals: 8, chain: ChainNetwork.LITECOIN },
];

async function hashPasswordArgon2(password: string): Promise<string> {
  const argon2 = await import('argon2');
  return argon2.hash(password, { type: argon2.argon2id });
}

async function main(): Promise<void> {
  await prisma.schemaMeta.upsert({
    where: { id: 'auvora' },
    create: { id: 'auvora', version: '0.3.0' },
    update: { version: '0.3.0' },
  });

  const permissionRecords = [];
  for (const permission of PERMISSIONS) {
    permissionRecords.push(
      await prisma.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: { description: permission.description },
      }),
    );
  }

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    create: { name: 'user', description: 'Standard authenticated user' },
    update: { description: 'Standard authenticated user' },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    create: { name: 'admin', description: 'Administrator' },
    update: { description: 'Administrator' },
  });

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    create: { name: 'super_admin', description: 'Super administrator' },
    update: { description: 'Super administrator' },
  });

  const allPermissionIds = permissionRecords.map((p) => p.id);
  for (const roleId of [adminRole.id, superAdminRole.id]) {
    for (const permissionId of allPermissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId },
        },
        create: { roleId, permissionId },
        update: {},
      });
    }
  }

  // Standard users can manage their own wallets (read/write only).
  for (const code of USER_WALLET_PERMISSION_CODES) {
    const permission = permissionRecords.find((p) => p.code === code);
    if (!permission) {
      continue;
    }
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: userRole.id, permissionId: permission.id },
      },
      create: { roleId: userRole.id, permissionId: permission.id },
      update: {},
    });
  }

  for (const asset of NATIVE_ASSETS) {
    await prisma.asset.upsert({
      where: { code: asset.code },
      create: {
        code: asset.code,
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        chain: asset.chain,
        standard: AssetStandard.NATIVE,
        isActive: true,
      },
      update: {
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        chain: asset.chain,
        standard: AssetStandard.NATIVE,
        isActive: true,
      },
    });
  }

  const adminEmail = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@auvora.local';
  const adminUsername = process.env['SEED_ADMIN_USERNAME'] ?? 'auvora_admin';
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'] ?? 'ChangeMe!AuvoraAdmin1';

  const passwordHash = await hashPasswordArgon2(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash,
      firstName: 'Auvora',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      emailVerified: true,
      preferredLanguage: 'en',
      timeZone: 'UTC',
    },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      deletedAt: null,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id },
    },
    create: { userId: adminUser.id, roleId: superAdminRole.id },
    update: {},
  });

  process.stdout.write(
    JSON.stringify({
      level: 'info',
      msg: 'database seed completed',
      service: 'database-seed',
      version: '0.3.0',
      adminEmail,
      adminUsername,
      // Intentionally omit password from logs.
      passwordFingerprint: createHash('sha256')
        .update(adminPassword)
        .digest('hex')
        .slice(0, 8),
      nonce: randomBytes(4).toString('hex'),
    }) + '\n',
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      JSON.stringify({
        level: 'error',
        msg: 'database seed failed',
        error: message,
      }) + '\n',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
