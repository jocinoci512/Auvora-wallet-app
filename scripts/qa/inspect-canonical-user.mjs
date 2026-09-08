import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../database/generated/client/index.js');
const prisma = new PrismaClient();
const userId = 'df1db712-5e50-42c1-92fc-2c7236244cf8';

async function run() {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      status: true,
      emailVerified: true,
      lastLoginAt: true,
      encryptedVaultBlob: {
        select: {
          id: true,
          epoch: true,
          algorithmId: true,
          kdfParams: true,
          updatedAt: true,
        },
      },
      devices: {
        select: {
          id: true,
          platform: true,
          deviceLabel: true,
          lastSeenAt: true,
          trusted: true,
        },
      },
    },
  });

  const kyc = await prisma.kycProfile.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      kycLevel: true,
      riskBand: true,
    },
  });

  const wallets = await prisma.wallet.findMany({
    where: { ownerUserId: userId },
    include: { asset: true },
  });

  console.log('--- USER SUMMARY ---');
  console.log(JSON.stringify(user, null, 2));
  console.log('--- KYC ---');
  console.log(JSON.stringify(kyc, null, 2));
  console.log('--- WALLETS ---');
  console.log(
    JSON.stringify(
      wallets.map((w) => ({
        id: w.id,
        alias: w.alias,
        asset: w.asset?.code,
        metadata: w.metadata,
        status: w.status,
      })),
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
