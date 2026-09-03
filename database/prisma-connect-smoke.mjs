import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('./generated/client/index.js');

const raw = process.env.DATABASE_URL ?? '';
try {
  const u = new URL(raw);
  console.log(`db=${u.pathname} host=${u.hostname}`);
} catch {
  console.log('DATABASE_URL missing/invalid');
}

const prisma = new PrismaClient();
try {
  await prisma.$connect();
  const rows = await prisma.$queryRawUnsafe('SELECT current_database() AS db');
  console.log('PRISMA_CONNECT=OK', rows);
} catch (e) {
  console.log('PRISMA_CONNECT=FAIL');
  console.log(String(e instanceof Error ? e.message : e).slice(0, 500));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
