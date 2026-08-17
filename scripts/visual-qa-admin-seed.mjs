/**
 * Seed a local-only Admin operator into isolated `auvora_e2e`.
 * Refuses any DATABASE_URL that is not auvora_e2e.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const argon2 = require('../database/node_modules/argon2');
const { PrismaClient, UserStatus } = require('../database/generated/client/index.js');

const DATABASE_URL = process.env.DATABASE_URL ?? '';
if (!DATABASE_URL.includes('auvora_e2e')) {
  throw new Error('Refusing to seed: DATABASE_URL must target isolated database auvora_e2e');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.local-data');
const outFile = path.join(outDir, 'visual-qa-admin.json');

const CAPS = {
  read_only: [
    'users:read',
    'sessions:read',
    'devices:read',
    'connections:read',
    'wallets:read',
    'security:read',
    'audit:read',
    'support:read',
    'admins:read',
    'roles:read',
    'health:read',
    'realtime:read',
  ],
};
CAPS.support = [...CAPS.read_only, 'users:write', 'support:write'];
CAPS.security_analyst = [
  ...CAPS.read_only,
  'security:manage',
  'sessions:revoke',
  'devices:revoke',
  'connections:revoke',
];
CAPS.admin = [
  ...CAPS.read_only,
  'users:write',
  'users:suspend',
  'users:reactivate',
  'sessions:revoke',
  'devices:revoke',
  'connections:revoke',
  'security:manage',
  'support:write',
];
CAPS.super_admin = [...CAPS.admin, 'admins:manage', 'roles:manage'];

const prisma = new PrismaClient();

async function ensureRoles() {
  const codes = [...new Set(Object.values(CAPS).flat())];
  const permissions = [];
  for (const code of codes) {
    const row = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
    permissions.push(row);
  }
  const byCode = Object.fromEntries(permissions.map((p) => [p.code, p]));
  for (const [name, granted] of Object.entries(CAPS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: name },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const perm of granted) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: byCode[perm].id },
      });
    }
  }
  await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'user' },
  });
}

async function upsertUser({ email, username, password, role, firstName, lastName }) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRow) throw new Error(`missing role ${role}`);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, status: UserStatus.ACTIVE, emailVerified: true, mfaEnabled: false },
    });
    await prisma.userRole.deleteMany({ where: { userId: existing.id } });
    await prisma.userRole.create({ data: { userId: existing.id, roleId: roleRow.id } });
    await prisma.mfaTotpCredential.deleteMany({ where: { userId: existing.id } });
    await prisma.mfaRecoveryCode.deleteMany({ where: { userId: existing.id } });
    return existing;
  }
  return prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      firstName,
      lastName,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      mfaEnabled: false,
      roles: { create: { roleId: roleRow.id } },
    },
  });
}

async function main() {
  await ensureRoles();
  const password = `Vqa!${randomBytes(8).toString('hex')}Aa`;
  const operator = await upsertUser({
    email: 'visualqa.super@auvora.test',
    username: 'visualqa-super',
    password,
    role: 'super_admin',
    firstName: 'Visual',
    lastName: 'QA',
  });
  await upsertUser({
    email: 'visualqa.user@auvora.test',
    username: 'visualqa-user',
    password: `Usr!${randomBytes(6).toString('hex')}Aa`,
    role: 'user',
    firstName: 'Directory',
    lastName: 'User',
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        email: 'visualqa.super@auvora.test',
        password,
        operatorId: operator.id,
        note: 'Local auvora_e2e only. MFA enrollment happens in the Admin UI.',
      },
      null,
      2,
    ),
    { encoding: 'utf8' },
  );
  process.stdout.write(`seeded ${operator.email} credentials at ${outFile}\n`);
}

main()
  .catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
