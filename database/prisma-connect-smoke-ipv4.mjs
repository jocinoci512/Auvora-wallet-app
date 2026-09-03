import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('./generated/client/index.js');

function preferIpv4(url) {
  return url
    .replace(/@localhost(?=[:/])/g, '@127.0.0.1')
    .replace(/:\/\/localhost(?=[:/])/g, '://127.0.0.1');
}

const raw = process.env.DATABASE_URL ?? '';
const rewritten = preferIpv4(raw);
const u = new URL(rewritten);
console.log(`trying host=${u.hostname} db=${u.pathname}`);

const prisma = new PrismaClient({ datasources: { db: { url: rewritten } } });
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
