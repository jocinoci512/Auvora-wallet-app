import { PrismaClient } from '@auvora/database-schema';

const prisma = new PrismaClient();
try {
  await prisma.$connect();
  console.log('PRISMA_CONNECT=OK');
} catch (e) {
  console.log('PRISMA_CONNECT=FAIL');
  console.log(String(e instanceof Error ? e.message : e).slice(0, 500));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
