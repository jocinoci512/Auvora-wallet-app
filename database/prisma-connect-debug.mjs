import { createRequire } from 'node:module';

process.env.DEBUG = 'prisma:engine*';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('./generated/client/index.js');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
try {
  await prisma.$connect();
  console.log('PRISMA_CONNECT=OK');
} catch (e) {
  console.log('PRISMA_CONNECT=FAIL');
  console.log(String(e instanceof Error ? e.stack || e.message : e).slice(0, 1500));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
