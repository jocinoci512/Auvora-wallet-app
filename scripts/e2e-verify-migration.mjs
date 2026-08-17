import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../database/generated/client/index.js');
const prisma = new PrismaClient();
const sql = readFileSync(
  new URL(
    '../database/prisma/migrations/20260816180000_admin_mfa_sessions/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

const existing = await prisma.user.findUnique({ where: { email: 'sentinel-e2e@auvora.test' } });
const before =
  existing ??
  (await prisma.user.create({
    data: {
      email: 'sentinel-e2e@auvora.test',
      username: 'sentinel_e2e',
      passwordHash: 'x'.repeat(60),
      firstName: 'Sentinel',
      lastName: 'Keep',
      status: 'ACTIVE',
      emailVerified: true,
    },
  }));
const role = await prisma.role.upsert({
  where: { name: 'admin' },
  update: {},
  create: { name: 'admin', description: 'admin' },
});
const alreadyLinked = await prisma.userRole.findFirst({
  where: { userId: before.id, roleId: role.id },
});
if (!alreadyLinked) {
  await prisma.userRole.create({ data: { userId: before.id, roleId: role.id } });
}
const statements = [];
let buffer = '';
let inDo = false;
for (const line of sql.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('--') || trimmed.length === 0) continue;
  if (trimmed.startsWith('DO $$')) inDo = true;
  buffer += `${line}\n`;
  if (inDo && trimmed === 'END $$;') {
    statements.push(buffer.trim());
    buffer = '';
    inDo = false;
    continue;
  }
  if (!inDo && trimmed.endsWith(';')) {
    statements.push(buffer.trim());
    buffer = '';
  }
}
for (const statement of statements) {
  await prisma.$executeRawUnsafe(statement);
}
const after = await prisma.user.findUnique({
  where: { id: before.id },
  include: { roles: { include: { role: true } } },
});
const tables = await prisma.$queryRawUnsafe(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'mfa_totp_credentials' ORDER BY ordinal_position
`);
const sessionCols = await prisma.$queryRawUnsafe(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'sessions' AND column_name IN ('surface','mfa_satisfied_at','step_up_expires_at')
`);
const recoveryCols = await prisma.$queryRawUnsafe(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'mfa_recovery_codes' ORDER BY ordinal_position
`);
console.log(
  JSON.stringify(
    {
      preservedUser: after?.email === 'sentinel-e2e@auvora.test',
      preservedRole: after?.roles?.[0]?.role?.name === 'admin',
      mfaTableCols: tables.map((t) => t.column_name),
      recoveryCols: recoveryCols.map((t) => t.column_name),
      sessionCols: sessionCols.map((t) => t.column_name),
      userCount: await prisma.user.count(),
    },
    null,
    2,
  ),
);
await prisma.userRole.deleteMany({ where: { userId: before.id } });
await prisma.user.delete({ where: { id: before.id } });
await prisma.$disconnect();
