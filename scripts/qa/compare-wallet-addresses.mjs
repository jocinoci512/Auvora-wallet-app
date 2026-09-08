/** LOCAL QA ONLY — safe public address comparison (no secrets). */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../database/generated/client/index.js');

const userId = 'df1db712-5e50-42c1-92fc-2c7236244cf8';

function mask(addr) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, username: true },
  });
  const watches = await prisma.watchAddress.findMany({
    where: { userId },
    select: { network: true, address: true },
    orderBy: { network: 'asc' },
  });
  const chainAddrs = await prisma.chainAddress.findMany({
    where: { ownerUserId: userId },
    select: { chain: true, address: true },
    orderBy: { chain: 'asc' },
  });
  const wallets = await prisma.wallet.findMany({
    where: { ownerUserId: userId },
    select: { alias: true, metadata: true, asset: { select: { code: true } } },
  });

  const byNetwork = new Map();
  for (const w of watches) byNetwork.set(w.network, w.address);
  for (const c of chainAddrs) byNetwork.set(c.chain, c.address);
  for (const w of wallets) {
    const meta = w.metadata;
    const addr = meta?.chainSync?.address;
    if (addr && w.asset.code) byNetwork.set(String(w.asset.code), addr);
  }

  const evm = byNetwork.get('ETHEREUM') ?? byNetwork.get('ETH');
  const bnb = byNetwork.get('BNB_SMART_CHAIN') ?? byNetwork.get('BNB');
  const pol = byNetwork.get('POLYGON') ?? byNetwork.get('POL');

  console.log(
    JSON.stringify(
      {
        user: user ? { email: user.email, username: user.username } : null,
        addresses: {
          ETHEREUM: evm ? mask(evm) : null,
          BNB: bnb ? mask(bnb) : evm ? mask(evm) : null,
          POLYGON: pol ? mask(pol) : evm ? mask(evm) : null,
          BITCOIN: byNetwork.get('BITCOIN') ? mask(byNetwork.get('BITCOIN')) : null,
          SOLANA: byNetwork.get('SOLANA') ? mask(byNetwork.get('SOLANA')) : null,
          TRON: byNetwork.get('TRON') ? mask(byNetwork.get('TRON')) : null,
        },
        evmShared:
          evm && bnb && pol
            ? evm.toLowerCase() === bnb.toLowerCase() && evm.toLowerCase() === pol.toLowerCase()
            : evm && !bnb && !pol
              ? 'evm_only_registered'
              : 'partial_registration',
        watchCount: watches.length,
        chainCount: chainAddrs.length,
        walletCount: wallets.length,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
