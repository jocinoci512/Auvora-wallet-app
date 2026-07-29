import { createHash, randomBytes } from 'node:crypto';
import { AssetStandard, ChainNetwork, PrismaClient, UserStatus } from '../generated/client';

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
  { code: 'blockchain:read', description: 'Read blockchain addresses and status' },
  { code: 'blockchain:write', description: 'Create and manage blockchain addresses' },
  { code: 'blockchain:admin', description: 'Administer blockchain providers and sync' },
  { code: 'blockchain:sync', description: 'Trigger blockchain synchronization jobs' },
  { code: 'payment:read', description: 'Read payments and payment methods' },
  { code: 'payment:write', description: 'Create and manage payments' },
  { code: 'payment:admin', description: 'Administer payments, providers, and disputes' },
  { code: 'payment:settle', description: 'Run and manage settlements' },
  { code: 'payment:reconcile', description: 'Run and review reconciliations' },
  { code: 'compliance:read', description: 'Read own compliance profile and verification status' },
  { code: 'compliance:write', description: 'Submit KYC and manage compliance documents' },
  { code: 'compliance:admin', description: 'Administer compliance platform' },
  { code: 'compliance:review', description: 'Review KYC documents and verifications' },
  { code: 'compliance:cases', description: 'Manage compliance investigation cases' },
  { code: 'compliance:rules', description: 'Manage compliance rules and providers' },
  { code: 'custody:read', description: 'Read custody keys and signing status' },
  { code: 'custody:write', description: 'Generate keys and manage recovery contacts' },
  { code: 'custody:admin', description: 'Administer custody platform' },
  { code: 'custody:sign', description: 'Create and execute signing requests' },
  { code: 'custody:approve', description: 'Approve or reject signing requests' },
  { code: 'custody:policies', description: 'Manage custody approval and transaction policies' },
  { code: 'custody:recovery', description: 'Manage recovery policies and requests' },
  { code: 'notification:read', description: 'Read notifications and delivery status' },
  { code: 'notification:write', description: 'Manage notification preferences and webhooks' },
  { code: 'notification:admin', description: 'Administer notification platform' },
  { code: 'notification:templates', description: 'Manage notification templates' },
  { code: 'notification:webhooks', description: 'Administer webhook endpoints' },
  { code: 'notification:broadcast', description: 'Send broadcast notifications' },
  { code: 'ai:read', description: 'Read AI conversations, usage, and knowledge search' },
  { code: 'ai:write', description: 'Create AI conversations and submit feedback' },
  { code: 'ai:admin', description: 'Administer AI platform, providers, and costs' },
  { code: 'ai:prompts', description: 'Manage AI prompt templates and versions' },
  { code: 'ai:knowledge', description: 'Manage AI knowledge sources and documents' },
  { code: 'ai:chat', description: 'Chat with AI assistants' },
  { code: 'analytics:read', description: 'View analytics dashboards, metrics, and KPIs' },
  { code: 'analytics:write', description: 'Configure personal analytics dashboards and reports' },
  { code: 'analytics:admin', description: 'Administer analytics platform' },
  { code: 'analytics:reports', description: 'Generate and export analytics reports' },
  { code: 'analytics:dashboards', description: 'Manage analytics dashboards' },
  { code: 'analytics:kpis', description: 'Manage KPI definitions' },
  { code: 'observability:read', description: 'View platform status and public incidents' },
  { code: 'observability:write', description: 'Manage maintenance notices and operational notes' },
  { code: 'observability:admin', description: 'Administer observability and SRE platform' },
  { code: 'observability:alerts', description: 'Manage alert rules and alerts' },
  { code: 'observability:incidents', description: 'Manage incidents and postmortems' },
  { code: 'observability:slo', description: 'Manage SLO/SLI definitions and measurements' },
  {
    code: 'infrastructure:read',
    description: 'View infrastructure environments and operations data',
  },
  {
    code: 'infrastructure:admin',
    description: 'Administer infrastructure platform and feature flags',
  },
  { code: 'infrastructure:deploy', description: 'Record and manage deployments' },
  { code: 'infrastructure:backup', description: 'Record and manage backup jobs' },
  { code: 'swap:read', description: 'Read swap quotes, routes, and history' },
  { code: 'swap:execute', description: 'Prepare and execute swaps' },
  { code: 'swap:admin', description: 'Administer swap providers and analytics' },
  { code: 'nft:read', description: 'Read NFT gallery, collections, and asset details' },
  { code: 'nft:write', description: 'Sync NFTs, favorites, hidden assets, and ownership checks' },
  { code: 'nft:admin', description: 'Administer NFT providers, workers, and sync metrics' },
  { code: 'staking:read', description: 'Read staking positions, validators, and yield analytics' },
  {
    code: 'staking:write',
    description: 'Prepare and confirm stake, unstake, and claim operations',
  },
  { code: 'staking:admin', description: 'Administer staking providers, validators, and sync' },
  {
    code: 'connections:read',
    description: 'Read hardware wallets, WalletConnect sessions, and watch addresses',
  },
  {
    code: 'connections:write',
    description: 'Pair devices, manage sessions, and confirm external signing',
  },
  {
    code: 'connections:admin',
    description: 'Administer connection providers, sessions, and workers',
  },
  { code: 'bridge:read', description: 'Read bridge quotes, routes, and history' },
  { code: 'bridge:execute', description: 'Prepare and confirm cross-chain bridge transfers' },
  { code: 'bridge:admin', description: 'Administer bridge providers, routes, and workers' },
];

const USER_WALLET_PERMISSION_CODES = [
  'wallets:read',
  'wallets:write',
  'blockchain:read',
  'blockchain:write',
  'payment:read',
  'payment:write',
  'compliance:read',
  'compliance:write',
  'custody:read',
  'custody:write',
  'custody:sign',
  'custody:approve',
  'custody:recovery',
  'notification:read',
  'notification:write',
  'notification:webhooks',
  'ai:read',
  'ai:write',
  'ai:chat',
  'analytics:read',
  'analytics:write',
  'analytics:reports',
  'analytics:dashboards',
  'observability:read',
  'swap:read',
  'swap:execute',
  'nft:read',
  'nft:write',
  'staking:read',
  'staking:write',
  'connections:read',
  'connections:write',
  'bridge:read',
  'bridge:execute',
] as const;

const NETWORK_CONFIGS: Array<{
  chain: ChainNetwork;
  displayName: string;
  requiredConfirmations: number;
  blockTimeSeconds: number;
  nativeSymbol: string;
  explorerUrl: string;
}> = [
  {
    chain: ChainNetwork.BITCOIN,
    displayName: 'Bitcoin',
    requiredConfirmations: 3,
    blockTimeSeconds: 600,
    nativeSymbol: 'BTC',
    explorerUrl: 'https://blockstream.info',
  },
  {
    chain: ChainNetwork.ETHEREUM,
    displayName: 'Ethereum',
    requiredConfirmations: 12,
    blockTimeSeconds: 12,
    nativeSymbol: 'ETH',
    explorerUrl: 'https://etherscan.io',
  },
  {
    chain: ChainNetwork.POLYGON,
    displayName: 'Polygon',
    requiredConfirmations: 64,
    blockTimeSeconds: 2,
    nativeSymbol: 'MATIC',
    explorerUrl: 'https://polygonscan.com',
  },
  {
    chain: ChainNetwork.BNB_SMART_CHAIN,
    displayName: 'BNB Smart Chain',
    requiredConfirmations: 15,
    blockTimeSeconds: 3,
    nativeSymbol: 'BNB',
    explorerUrl: 'https://bscscan.com',
  },
  {
    chain: ChainNetwork.SOLANA,
    displayName: 'Solana',
    requiredConfirmations: 32,
    blockTimeSeconds: 1,
    nativeSymbol: 'SOL',
    explorerUrl: 'https://solscan.io',
  },
  {
    chain: ChainNetwork.TRON,
    displayName: 'TRON',
    requiredConfirmations: 20,
    blockTimeSeconds: 3,
    nativeSymbol: 'TRX',
    explorerUrl: 'https://tronscan.org',
  },
  {
    chain: ChainNetwork.LITECOIN,
    displayName: 'Litecoin',
    requiredConfirmations: 6,
    blockTimeSeconds: 150,
    nativeSymbol: 'LTC',
    explorerUrl: 'https://blockchair.com/litecoin',
  },
];

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
    create: { id: 'auvora', version: '1.2.0' },
    update: { version: '1.2.0' },
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

  for (const network of NETWORK_CONFIGS) {
    const networkRecord = await prisma.blockchainNetworkConfig.upsert({
      where: { chain: network.chain },
      create: {
        chain: network.chain,
        displayName: network.displayName,
        requiredConfirmations: network.requiredConfirmations,
        blockTimeSeconds: network.blockTimeSeconds,
        nativeSymbol: network.nativeSymbol,
        explorerUrl: network.explorerUrl,
        isEnabled: true,
      },
      update: {
        displayName: network.displayName,
        requiredConfirmations: network.requiredConfirmations,
        blockTimeSeconds: network.blockTimeSeconds,
        nativeSymbol: network.nativeSymbol,
        explorerUrl: network.explorerUrl,
        isEnabled: true,
      },
    });

    await prisma.blockchainProviderRecord.upsert({
      where: {
        chain_code: { chain: network.chain, code: 'local-simulator' },
      },
      create: {
        chain: network.chain,
        networkId: networkRecord.id,
        code: 'local-simulator',
        name: `${network.displayName} Local Simulator`,
        isPrimary: false,
        isEnabled: true,
        priority: 100,
        metadata: { mode: 'simulator' },
      },
      update: {
        name: `${network.displayName} Local Simulator`,
        isPrimary: false,
        isEnabled: true,
        priority: 100,
        networkId: networkRecord.id,
      },
    });

    const alchemyChains = new Set(['ETHEREUM', 'BNB_SMART_CHAIN', 'SOLANA', 'TRON', 'BITCOIN']);
    if (alchemyChains.has(network.chain)) {
      await prisma.blockchainProviderRecord.upsert({
        where: {
          chain_code: { chain: network.chain, code: 'alchemy' },
        },
        create: {
          chain: network.chain,
          networkId: networkRecord.id,
          code: 'alchemy',
          name: `${network.displayName} Alchemy`,
          isPrimary: true,
          isEnabled: true,
          priority: 1,
          metadata: { mode: 'alchemy', infrastructure: 'alchemy' },
        },
        update: {
          name: `${network.displayName} Alchemy`,
          isPrimary: true,
          isEnabled: true,
          priority: 1,
          networkId: networkRecord.id,
          metadata: { mode: 'alchemy', infrastructure: 'alchemy' },
        },
      });
    }
  }

  const paymentProviders: Array<{
    code: string;
    name: string;
    providerType: string;
    isPrimary: boolean;
    priority: number;
    capabilities: string[];
  }> = [
    {
      code: 'local-fiat-simulator',
      name: 'Local Fiat Simulator',
      providerType: 'FIAT',
      isPrimary: true,
      priority: 1,
      capabilities: ['FIAT_DEPOSIT', 'FIAT_WITHDRAWAL', 'SCHEDULED_PAYMENT', 'RECURRING_PAYMENT'],
    },
    {
      code: 'internal-transfer',
      name: 'Internal Transfer Provider',
      providerType: 'INTERNAL',
      isPrimary: true,
      priority: 1,
      capabilities: ['INTERNAL_TRANSFER', 'WALLET_TRANSFER'],
    },
    {
      code: 'crypto-bridge',
      name: 'Crypto Bridge Provider',
      providerType: 'CRYPTO',
      isPrimary: true,
      priority: 1,
      capabilities: ['CRYPTO_DEPOSIT', 'CRYPTO_WITHDRAWAL'],
    },
    {
      code: 'merchant-simulator',
      name: 'Merchant Payment Simulator',
      providerType: 'MERCHANT',
      isPrimary: true,
      priority: 1,
      capabilities: ['MERCHANT_PAYMENT', 'PAYMENT_REQUEST', 'REFUND', 'REVERSAL'],
    },
  ];

  for (const provider of paymentProviders) {
    await prisma.paymentProviderRecord.upsert({
      where: { code: provider.code },
      create: {
        code: provider.code,
        name: provider.name,
        providerType: provider.providerType,
        isPrimary: provider.isPrimary,
        isEnabled: true,
        priority: provider.priority,
        capabilities: provider.capabilities,
        metadata: { mode: 'simulator' },
      },
      update: {
        name: provider.name,
        providerType: provider.providerType,
        isPrimary: provider.isPrimary,
        isEnabled: true,
        priority: provider.priority,
        capabilities: provider.capabilities,
      },
    });
  }

  const defaultLimits: Array<{
    window: 'PER_TRANSACTION' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    amount: string;
    currency: string;
    accountTier: string;
  }> = [
    { window: 'PER_TRANSACTION', amount: '10000', currency: 'USD', accountTier: 'standard' },
    { window: 'DAILY', amount: '25000', currency: 'USD', accountTier: 'standard' },
    { window: 'WEEKLY', amount: '100000', currency: 'USD', accountTier: 'standard' },
    { window: 'MONTHLY', amount: '250000', currency: 'USD', accountTier: 'standard' },
  ];

  for (const limit of defaultLimits) {
    const existing = await prisma.paymentLimit.findFirst({
      where: {
        window: limit.window,
        currency: limit.currency,
        accountTier: limit.accountTier,
        ownerUserId: null,
        assetCode: null,
        country: null,
        riskProfile: null,
      },
    });
    if (!existing) {
      await prisma.paymentLimit.create({
        data: {
          window: limit.window,
          amount: limit.amount,
          currency: limit.currency,
          accountTier: limit.accountTier,
          isEnabled: true,
        },
      });
    }
  }

  const complianceProviders: Array<{
    code: string;
    name: string;
    providerType:
      | 'IDENTITY'
      | 'DOCUMENT'
      | 'SANCTIONS'
      | 'PEP'
      | 'ADDRESS_RISK'
      | 'BLOCKCHAIN_ANALYTICS'
      | 'FRAUD'
      | 'RISK_SCORING'
      | 'TRAVEL_RULE';
    isPrimary: boolean;
    priority: number;
  }> = [
    {
      code: 'local-identity-simulator',
      name: 'Local Identity Simulator',
      providerType: 'IDENTITY',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-document-simulator',
      name: 'Local Document Simulator',
      providerType: 'DOCUMENT',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-sanctions-simulator',
      name: 'Local Sanctions Simulator',
      providerType: 'SANCTIONS',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-pep-simulator',
      name: 'Local PEP Simulator',
      providerType: 'PEP',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-address-risk-simulator',
      name: 'Local Address Risk Simulator',
      providerType: 'ADDRESS_RISK',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-chain-analytics-simulator',
      name: 'Local Blockchain Analytics Simulator',
      providerType: 'BLOCKCHAIN_ANALYTICS',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-fraud-simulator',
      name: 'Local Fraud Simulator',
      providerType: 'FRAUD',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-risk-simulator',
      name: 'Local Risk Scoring Simulator',
      providerType: 'RISK_SCORING',
      isPrimary: true,
      priority: 1,
    },
    {
      code: 'local-travel-rule-simulator',
      name: 'Local Travel Rule Simulator',
      providerType: 'TRAVEL_RULE',
      isPrimary: true,
      priority: 1,
    },
  ];

  for (const provider of complianceProviders) {
    await prisma.complianceProviderRecord.upsert({
      where: { code: provider.code },
      create: {
        code: provider.code,
        name: provider.name,
        providerType: provider.providerType,
        isPrimary: provider.isPrimary,
        isEnabled: true,
        priority: provider.priority,
        metadata: { mode: 'simulator' },
      },
      update: {
        name: provider.name,
        providerType: provider.providerType,
        isPrimary: provider.isPrimary,
        isEnabled: true,
        priority: provider.priority,
      },
    });
  }

  const defaultComplianceRules: Array<{
    code: string;
    name: string;
    description: string;
    action: 'ALLOW' | 'FLAG' | 'HOLD' | 'BLOCK' | 'REQUIRE_REVIEW' | 'OPEN_CASE';
    priority: number;
    expression: Record<string, unknown>;
  }> = [
    {
      code: 'high-value-tx',
      name: 'High value transaction',
      description: 'Flag transactions above 10,000 in a single payment',
      action: 'FLAG',
      priority: 10,
      expression: { field: 'amount', op: 'gte', value: 10000 },
    },
    {
      code: 'structuring-velocity',
      name: 'Structuring / velocity',
      description: 'Hold when daily payment count exceeds threshold',
      action: 'HOLD',
      priority: 20,
      expression: { field: 'dailyCount', op: 'gte', value: 8 },
    },
    {
      code: 'high-risk-country',
      name: 'High risk country',
      description: 'Require review for elevated country risk',
      action: 'REQUIRE_REVIEW',
      priority: 30,
      expression: { field: 'countryRisk', op: 'gte', value: 70 },
    },
    {
      code: 'critical-risk-block',
      name: 'Critical risk block',
      description: 'Block when composite risk score is critical',
      action: 'BLOCK',
      priority: 5,
      expression: { field: 'riskScore', op: 'gte', value: 90 },
    },
  ];

  for (const rule of defaultComplianceRules) {
    await prisma.complianceRule.upsert({
      where: { code: rule.code },
      create: {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        action: rule.action,
        priority: rule.priority,
        expression: rule.expression,
        isEnabled: true,
      },
      update: {
        name: rule.name,
        description: rule.description,
        action: rule.action,
        priority: rule.priority,
        expression: rule.expression,
        isEnabled: true,
      },
    });
  }

  const custodyProviders: Array<{
    code: string;
    name: string;
    custodyModel: 'SELF' | 'HOSTED' | 'SHARED' | 'INSTITUTIONAL' | 'MPC' | 'HSM';
    priority: number;
  }> = [
    { code: 'sim-self', name: 'Simulator Self Custody', custodyModel: 'SELF', priority: 10 },
    { code: 'sim-hosted', name: 'Simulator Hosted Custody', custodyModel: 'HOSTED', priority: 20 },
    { code: 'sim-shared', name: 'Simulator Shared Custody', custodyModel: 'SHARED', priority: 30 },
    {
      code: 'sim-institutional',
      name: 'Simulator Institutional',
      custodyModel: 'INSTITUTIONAL',
      priority: 40,
    },
    { code: 'sim-mpc', name: 'Simulator MPC', custodyModel: 'MPC', priority: 50 },
    { code: 'sim-hsm', name: 'Simulator HSM', custodyModel: 'HSM', priority: 60 },
  ];

  for (const provider of custodyProviders) {
    await prisma.custodyProviderRecord.upsert({
      where: { code: provider.code },
      create: {
        code: provider.code,
        name: provider.name,
        custodyModel: provider.custodyModel,
        priority: provider.priority,
        isEnabled: true,
        healthStatus: 'HEALTHY',
      },
      update: {
        name: provider.name,
        custodyModel: provider.custodyModel,
        priority: provider.priority,
        isEnabled: true,
      },
    });
  }

  const defaultApprovalPolicies: Array<{
    code: string;
    name: string;
    kind: 'SINGLE' | 'DUAL' | 'THRESHOLD' | 'AMOUNT_BASED' | 'RISK_BASED';
    threshold: number;
    amountThreshold?: string;
    riskThreshold?: number;
  }> = [
    { code: 'single-default', name: 'Single approval', kind: 'SINGLE', threshold: 1 },
    { code: 'dual-control', name: 'Dual control', kind: 'DUAL', threshold: 2 },
    { code: 'threshold-2-of-3', name: '2-of-3 threshold', kind: 'THRESHOLD', threshold: 2 },
    {
      code: 'amount-high-value',
      name: 'High value amount',
      kind: 'AMOUNT_BASED',
      threshold: 1,
      amountThreshold: '10000',
    },
    {
      code: 'risk-elevated',
      name: 'Elevated risk approval',
      kind: 'RISK_BASED',
      threshold: 1,
      riskThreshold: 70,
    },
  ];

  for (const policy of defaultApprovalPolicies) {
    await prisma.approvalPolicy.upsert({
      where: { code: policy.code },
      create: {
        code: policy.code,
        name: policy.name,
        kind: policy.kind,
        threshold: policy.threshold,
        amountThreshold: policy.amountThreshold,
        riskThreshold: policy.riskThreshold,
        isEnabled: true,
      },
      update: {
        name: policy.name,
        kind: policy.kind,
        threshold: policy.threshold,
        amountThreshold: policy.amountThreshold,
        riskThreshold: policy.riskThreshold,
        isEnabled: true,
      },
    });
  }

  await prisma.recoveryPolicy.upsert({
    where: { code: 'default-recovery' },
    create: {
      code: 'default-recovery',
      name: 'Default recovery',
      description: 'Standard recovery with timeout',
      requiredApprovals: 1,
      timeoutHours: 72,
      isEnabled: true,
    },
    update: {
      name: 'Default recovery',
      requiredApprovals: 1,
      timeoutHours: 72,
      isEnabled: true,
    },
  });

  const defaultTxPolicies: Array<{
    code: string;
    name: string;
    action: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'DELAY' | 'ALERT';
    priority: number;
    expression: Record<string, unknown>;
  }> = [
    {
      code: 'high-amount-approval',
      name: 'High amount requires approval',
      action: 'REQUIRE_APPROVAL',
      priority: 10,
      expression: { field: 'amount', op: 'gte', value: 5000 },
    },
    {
      code: 'deny-sanctioned-destination',
      name: 'Deny sanctioned destinations',
      action: 'DENY',
      priority: 5,
      expression: { field: 'complianceResult', op: 'eq', value: 'BLOCK' },
    },
    {
      code: 'velocity-delay',
      name: 'Delay high velocity',
      action: 'DELAY',
      priority: 20,
      expression: { field: 'velocity', op: 'gte', value: 10 },
    },
  ];

  for (const policy of defaultTxPolicies) {
    await prisma.transactionPolicy.upsert({
      where: { code: policy.code },
      create: {
        code: policy.code,
        name: policy.name,
        action: policy.action,
        priority: policy.priority,
        expression: policy.expression,
        isEnabled: true,
      },
      update: {
        name: policy.name,
        action: policy.action,
        priority: policy.priority,
        expression: policy.expression,
        isEnabled: true,
      },
    });
  }

  const notificationProviders: Array<{
    code: string;
    name: string;
    channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP' | 'BROWSER' | 'WEBHOOK' | 'SLACK' | 'TEAMS';
    priority: number;
  }> = [
    { code: 'sim-email', name: 'Simulator Email', channel: 'EMAIL', priority: 10 },
    { code: 'sim-sms', name: 'Simulator SMS', channel: 'SMS', priority: 20 },
    { code: 'sim-push', name: 'Simulator Push', channel: 'PUSH', priority: 30 },
    { code: 'sim-in-app', name: 'Simulator In-App', channel: 'IN_APP', priority: 40 },
    { code: 'sim-browser', name: 'Simulator Browser', channel: 'BROWSER', priority: 50 },
    { code: 'sim-webhook', name: 'Simulator Webhook', channel: 'WEBHOOK', priority: 60 },
    { code: 'sim-slack', name: 'Simulator Slack', channel: 'SLACK', priority: 70 },
    { code: 'sim-teams', name: 'Simulator Teams', channel: 'TEAMS', priority: 80 },
  ];

  for (const provider of notificationProviders) {
    await prisma.notificationChannelProvider.upsert({
      where: { code: provider.code },
      create: {
        code: provider.code,
        name: provider.name,
        channel: provider.channel,
        priority: provider.priority,
        isEnabled: true,
        healthStatus: 'HEALTHY',
      },
      update: {
        name: provider.name,
        channel: provider.channel,
        priority: provider.priority,
        isEnabled: true,
      },
    });
  }

  const defaultTemplates: Array<{
    code: string;
    name: string;
    category: 'AUTH' | 'SECURITY' | 'PAYMENT' | 'SYSTEM' | 'CUSTODY' | 'COMPLIANCE';
    channel: 'EMAIL' | 'IN_APP';
    subject: string;
    body: string;
  }> = [
    {
      code: 'auth.email_verification',
      name: 'Email verification',
      category: 'AUTH',
      channel: 'EMAIL',
      subject: 'Verify your Auvora account',
      body: 'Hello {{name}}, verify your email: {{link}}',
    },
    {
      code: 'auth.password_reset',
      name: 'Password reset',
      category: 'AUTH',
      channel: 'EMAIL',
      subject: 'Reset your Auvora password',
      body: 'Hello {{name}}, reset your password: {{link}}',
    },
    {
      code: 'security.login_alert',
      name: 'Login alert',
      category: 'SECURITY',
      channel: 'IN_APP',
      subject: 'New sign-in',
      body: 'A new sign-in was detected for your account.',
    },
    {
      code: 'payment.received',
      name: 'Payment received',
      category: 'PAYMENT',
      channel: 'IN_APP',
      subject: 'Payment received',
      body: 'You received {{amount}} {{currency}}.',
    },
    {
      code: 'system.maintenance',
      name: 'System maintenance',
      category: 'SYSTEM',
      channel: 'IN_APP',
      subject: 'Scheduled maintenance',
      body: 'Auvora will undergo maintenance at {{when}}.',
    },
  ];

  for (const tpl of defaultTemplates) {
    await prisma.notificationTemplate.upsert({
      where: {
        code_channel_locale: { code: tpl.code, channel: tpl.channel, locale: 'en' },
      },
      create: {
        code: tpl.code,
        name: tpl.name,
        category: tpl.category,
        channel: tpl.channel,
        subject: tpl.subject,
        body: tpl.body,
        format: 'TEXT',
        locale: 'en',
        isEnabled: true,
        currentVersion: 1,
      },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
        isEnabled: true,
      },
    });
  }

  const aiProviders: Array<{
    code: string;
    name: string;
    providerType: 'SIMULATOR' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'AZURE_OPENAI' | 'LOCAL';
    priority: number;
    defaultModel: string;
  }> = [
    {
      code: 'sim-default',
      name: 'Simulator LLM',
      providerType: 'SIMULATOR',
      priority: 10,
      defaultModel: 'sim-gpt',
    },
    {
      code: 'openai-default',
      name: 'OpenAI',
      providerType: 'OPENAI',
      priority: 20,
      defaultModel: 'gpt-4o-mini',
    },
    {
      code: 'anthropic-default',
      name: 'Anthropic',
      providerType: 'ANTHROPIC',
      priority: 30,
      defaultModel: 'claude-3-5-haiku-latest',
    },
    {
      code: 'gemini-default',
      name: 'Google Gemini',
      providerType: 'GEMINI',
      priority: 40,
      defaultModel: 'gemini-1.5-flash',
    },
    {
      code: 'azure-openai-default',
      name: 'Azure OpenAI',
      providerType: 'AZURE_OPENAI',
      priority: 50,
      defaultModel: 'gpt-4o-mini',
    },
    {
      code: 'local-default',
      name: 'Local LLM',
      providerType: 'LOCAL',
      priority: 60,
      defaultModel: 'local-llm',
    },
  ];

  // AI provider upsert: `priority` and `isEnabled` are runtime operational config (adjustable via
  // the admin API without a deploy — see ModelRouterService.setPriority/setEnabled/upsertProvider).
  // On update we intentionally only touch name/defaultModel/providerType so a re-seed never
  // clobbers operator changes made in production. New rows of an *existing* providerType are
  // config-only (no code change needed); a brand-new providerType still requires a matching case
  // in AiProviderRegistry.buildBackend (services/ai/src/infrastructure/providers/provider-registry.ts).
  for (const provider of aiProviders) {
    await prisma.aiProvider.upsert({
      where: { code: provider.code },
      create: {
        code: provider.code,
        name: provider.name,
        providerType: provider.providerType,
        priority: provider.priority,
        defaultModel: provider.defaultModel,
        isEnabled: provider.providerType === 'SIMULATOR',
        healthStatus: provider.providerType === 'SIMULATOR' ? 'HEALTHY' : 'UNKNOWN',
      },
      update: {
        name: provider.name,
        providerType: provider.providerType,
        defaultModel: provider.defaultModel,
      },
    });
  }

  const aiPrompts: Array<{
    code: string;
    name: string;
    category:
      | 'SUPPORT'
      | 'WALLET'
      | 'PAYMENT'
      | 'COMPLIANCE'
      | 'FRAUD'
      | 'OPERATIONS'
      | 'ADMIN'
      | 'DEVELOPER'
      | 'DOCUMENTATION';
    systemPrompt: string;
    userPrompt: string;
  }> = [
    {
      code: 'assistant.customer_support',
      name: 'Customer Support Assistant',
      category: 'SUPPORT',
      systemPrompt:
        'You are the Auvora Wallet customer support assistant. Be concise, accurate, and never invent balances or transactions.',
      userPrompt: '{{message}}',
    },
    {
      code: 'assistant.wallet',
      name: 'Wallet Assistant',
      category: 'WALLET',
      systemPrompt: 'You help users understand wallets, transfers, and balances in Auvora Wallet.',
      userPrompt: '{{message}}',
    },
    {
      code: 'assistant.payment',
      name: 'Payment Assistant',
      category: 'PAYMENT',
      systemPrompt: 'You explain payment statuses, refunds, and settlements for Auvora Wallet.',
      userPrompt: '{{message}}',
    },
    {
      code: 'assistant.compliance',
      name: 'Compliance Assistant',
      category: 'COMPLIANCE',
      systemPrompt:
        'You assist with KYC/AML explanations using only provided context. Do not invent screening results.',
      userPrompt: '{{message}}',
    },
    {
      code: 'automation.case_summary',
      name: 'Case Summary',
      category: 'COMPLIANCE',
      systemPrompt: 'Summarize the compliance case using only the supplied facts.',
      userPrompt: 'Summarize this case:\n{{case}}',
    },
    {
      code: 'automation.transaction_explain',
      name: 'Transaction Explanation',
      category: 'WALLET',
      systemPrompt: 'Explain the transaction clearly for an end user using only supplied data.',
      userPrompt: 'Explain this transaction:\n{{transaction}}',
    },
  ];

  for (const prompt of aiPrompts) {
    const existing = await prisma.aiPromptTemplate.findUnique({ where: { code: prompt.code } });
    if (!existing) {
      await prisma.aiPromptTemplate.create({
        data: {
          code: prompt.code,
          name: prompt.name,
          category: prompt.category,
          status: 'APPROVED',
          isEnabled: true,
          currentVersion: 1,
          versions: {
            create: {
              version: 1,
              systemPrompt: prompt.systemPrompt,
              userPrompt: prompt.userPrompt,
              variables: { message: 'string' },
              changeNotes: 'Initial seed version',
            },
          },
        },
      });
    }
  }

  await prisma.aiKnowledgeSource.upsert({
    where: { code: 'product-docs' },
    create: {
      code: 'product-docs',
      name: 'Product Documentation',
      description: 'Seeded Auvora product knowledge base',
      sourceType: 'MANUAL',
      isEnabled: true,
      version: 1,
    },
    update: {
      name: 'Product Documentation',
      isEnabled: true,
    },
  });

  await prisma.aiVectorIndexMeta.upsert({
    where: { code: 'default' },
    create: {
      code: 'default',
      name: 'Default Vector Index',
      model: 'sim-embed-v1',
      dimensions: 32,
      documentCount: 0,
      chunkCount: 0,
    },
    update: {
      name: 'Default Vector Index',
      model: 'sim-embed-v1',
      dimensions: 32,
    },
  });

  const metricDefs: Array<{
    code: string;
    name: string;
    domain: 'CUSTOMER' | 'WALLET' | 'PAYMENTS' | 'NOTIFICATIONS' | 'AI' | 'AUTH' | 'INFRASTRUCTURE';
    valueType: 'COUNTER' | 'GAUGE' | 'RATE' | 'RATIO' | 'DURATION_MS';
    unit?: string;
  }> = [
    {
      code: 'dau',
      name: 'Daily Active Users',
      domain: 'CUSTOMER',
      valueType: 'GAUGE',
      unit: 'users',
    },
    {
      code: 'mau',
      name: 'Monthly Active Users',
      domain: 'CUSTOMER',
      valueType: 'GAUGE',
      unit: 'users',
    },
    {
      code: 'tx_volume',
      name: 'Transaction Volume',
      domain: 'WALLET',
      valueType: 'COUNTER',
      unit: 'count',
    },
    {
      code: 'wallet_growth',
      name: 'Wallet Growth',
      domain: 'WALLET',
      valueType: 'GAUGE',
      unit: 'wallets',
    },
    {
      code: 'payment_success_rate',
      name: 'Payment Success Rate',
      domain: 'PAYMENTS',
      valueType: 'RATIO',
      unit: 'ratio',
    },
    {
      code: 'notification_delivery_rate',
      name: 'Notification Delivery Rate',
      domain: 'NOTIFICATIONS',
      valueType: 'RATIO',
      unit: 'ratio',
    },
    {
      code: 'notification_sent_count',
      name: 'Notification Sent Count',
      domain: 'NOTIFICATIONS',
      valueType: 'COUNTER',
      unit: 'count',
    },
    {
      code: 'ai_request_count',
      name: 'AI Request Count',
      domain: 'AI',
      valueType: 'COUNTER',
      unit: 'count',
    },
    {
      code: 'dashboard_load_ms',
      name: 'Dashboard Load Duration',
      domain: 'INFRASTRUCTURE',
      valueType: 'DURATION_MS',
      unit: 'ms',
    },
    {
      code: 'report_generate_ms',
      name: 'Report Generate Duration',
      domain: 'INFRASTRUCTURE',
      valueType: 'DURATION_MS',
      unit: 'ms',
    },
    {
      code: 'aggregation_duration_ms',
      name: 'Aggregation Duration',
      domain: 'INFRASTRUCTURE',
      valueType: 'DURATION_MS',
      unit: 'ms',
    },
  ];

  for (const metric of metricDefs) {
    await prisma.metricDefinition.upsert({
      where: { code: metric.code },
      create: {
        code: metric.code,
        name: metric.name,
        domain: metric.domain,
        valueType: metric.valueType,
        unit: metric.unit,
        isEnabled: true,
      },
      update: {
        name: metric.name,
        domain: metric.domain,
        valueType: metric.valueType,
        unit: metric.unit,
      },
    });
  }

  const kpiDefs: Array<{
    code: string;
    name: string;
    domain: 'CUSTOMER' | 'WALLET' | 'PAYMENTS' | 'NOTIFICATIONS' | 'AI';
    metricCode: string;
    targetValue: number;
    higherIsBetter: boolean;
  }> = [
    {
      code: 'kpi.dau',
      name: 'DAU Target',
      domain: 'CUSTOMER',
      metricCode: 'dau',
      targetValue: 1000,
      higherIsBetter: true,
    },
    {
      code: 'kpi.payment_success',
      name: 'Payment Success',
      domain: 'PAYMENTS',
      metricCode: 'payment_success_rate',
      targetValue: 0.99,
      higherIsBetter: true,
    },
    {
      code: 'kpi.notification_delivery',
      name: 'Notification Delivery',
      domain: 'NOTIFICATIONS',
      metricCode: 'notification_delivery_rate',
      targetValue: 0.995,
      higherIsBetter: true,
    },
    {
      code: 'kpi.tx_volume',
      name: 'Daily TX Volume',
      domain: 'WALLET',
      metricCode: 'tx_volume',
      targetValue: 500,
      higherIsBetter: true,
    },
  ];

  for (const kpi of kpiDefs) {
    await prisma.kpiDefinition.upsert({
      where: { code: kpi.code },
      create: {
        code: kpi.code,
        name: kpi.name,
        domain: kpi.domain,
        metricCode: kpi.metricCode,
        targetValue: kpi.targetValue,
        higherIsBetter: kpi.higherIsBetter,
        isEnabled: true,
      },
      update: {
        name: kpi.name,
        metricCode: kpi.metricCode,
        targetValue: kpi.targetValue,
        higherIsBetter: kpi.higherIsBetter,
      },
    });
  }

  const systemDashboards: Array<{
    code: string;
    name: string;
    domain: 'ADMIN' | 'PAYMENTS' | 'COMPLIANCE' | 'AI' | 'INFRASTRUCTURE' | 'SYSTEM' | 'CUSTODY';
  }> = [
    { code: 'executive', name: 'Executive Dashboard', domain: 'ADMIN' },
    { code: 'operations', name: 'Operations Dashboard', domain: 'SYSTEM' },
    { code: 'finance', name: 'Finance Dashboard', domain: 'PAYMENTS' },
    { code: 'compliance', name: 'Compliance Dashboard', domain: 'COMPLIANCE' },
    { code: 'security', name: 'Security Dashboard', domain: 'ADMIN' },
    { code: 'ai', name: 'AI Dashboard', domain: 'AI' },
    { code: 'infrastructure', name: 'Infrastructure Dashboard', domain: 'INFRASTRUCTURE' },
  ];

  for (const dash of systemDashboards) {
    await prisma.analyticsDashboard.upsert({
      where: { code: dash.code },
      create: {
        code: dash.code,
        name: dash.name,
        domain: dash.domain,
        visibility: 'SYSTEM',
        isSystem: true,
        isEnabled: true,
        layout: { columns: 12 },
      },
      update: {
        name: dash.name,
        domain: dash.domain,
      },
    });
  }

  const reportTemplates: Array<{
    code: string;
    name: string;
    domain: 'WALLET' | 'PAYMENTS' | 'COMPLIANCE';
    querySpec: Record<string, unknown>;
  }> = [
    {
      code: 'wallet_activity',
      name: 'Wallet Activity Report',
      domain: 'WALLET',
      querySpec: { metrics: ['tx_volume', 'wallet_growth'], window: 'DAILY' },
    },
    {
      code: 'payment_summary',
      name: 'Payment Summary Report',
      domain: 'PAYMENTS',
      querySpec: { metrics: ['payment_success_rate'], window: 'DAILY' },
    },
    {
      code: 'compliance_overview',
      name: 'Compliance Overview Report',
      domain: 'COMPLIANCE',
      querySpec: { metrics: [], window: 'DAILY' },
    },
  ];

  for (const tpl of reportTemplates) {
    await prisma.reportTemplate.upsert({
      where: { code: tpl.code },
      create: {
        code: tpl.code,
        name: tpl.name,
        domain: tpl.domain,
        querySpec: tpl.querySpec,
        defaultFormat: 'JSON',
        isEnabled: true,
        version: 1,
      },
      update: {
        name: tpl.name,
        querySpec: tpl.querySpec,
      },
    });
  }

  for (const model of [
    {
      code: 'wallet_growth_linear',
      name: 'Wallet Growth Forecast',
      domain: 'WALLET' as const,
      metricCode: 'wallet_growth',
    },
    {
      code: 'tx_volume_linear',
      name: 'Transaction Volume Forecast',
      domain: 'WALLET' as const,
      metricCode: 'tx_volume',
    },
  ]) {
    await prisma.forecastModel.upsert({
      where: { code: model.code },
      create: {
        code: model.code,
        name: model.name,
        domain: model.domain,
        metricCode: model.metricCode,
        algorithm: 'linear_trend',
        horizon: 'MONTH',
        isEnabled: true,
      },
      update: {
        name: model.name,
        metricCode: model.metricCode,
      },
    });
  }

  const obsMetrics = [
    {
      code: 'http_latency_ms',
      name: 'HTTP latency',
      domain: 'GATEWAY' as const,
      kind: 'HISTOGRAM' as const,
      unit: 'ms',
    },
    {
      code: 'error_rate',
      name: 'Error rate',
      domain: 'SYSTEM' as const,
      kind: 'GAUGE' as const,
      unit: 'ratio',
    },
    {
      code: 'queue_depth',
      name: 'Queue depth',
      domain: 'NOTIFICATIONS' as const,
      kind: 'GAUGE' as const,
      unit: 'count',
    },
    {
      code: 'cpu_percent',
      name: 'CPU percent',
      domain: 'INFRASTRUCTURE' as const,
      kind: 'GAUGE' as const,
      unit: '%',
    },
  ];
  for (const metric of obsMetrics) {
    await prisma.obsMetricDefinition.upsert({
      where: { code: metric.code },
      create: {
        code: metric.code,
        name: metric.name,
        domain: metric.domain,
        kind: metric.kind,
        unit: metric.unit,
      },
      update: { name: metric.name, isEnabled: true },
    });
  }

  await prisma.obsAlertRule.upsert({
    where: { code: 'http_latency_critical' },
    create: {
      code: 'http_latency_critical',
      name: 'HTTP latency critical',
      domain: 'GATEWAY',
      metricCode: 'http_latency_ms',
      ruleType: 'threshold',
      severity: 'CRITICAL',
      threshold: 1000,
      comparison: 'gt',
      windowSeconds: 300,
    },
    update: { isEnabled: true },
  });

  await prisma.obsSloDefinition.upsert({
    where: { code: 'gateway_availability' },
    create: {
      code: 'gateway_availability',
      name: 'Gateway availability',
      serviceName: 'gateway',
      domain: 'GATEWAY',
      indicatorType: 'AVAILABILITY',
      targetPercent: 99.9,
      windowDays: 30,
    },
    update: { isEnabled: true },
  });

  const dependencies = [
    { sourceService: 'gateway', targetService: 'auth', isCritical: true },
    { sourceService: 'gateway', targetService: 'wallet', isCritical: true },
    { sourceService: 'wallet', targetService: 'blockchain', isCritical: true },
    { sourceService: 'payments', targetService: 'wallet', isCritical: true },
    { sourceService: 'blockchain', targetService: 'custody', isCritical: false },
  ];
  for (const dep of dependencies) {
    await prisma.obsServiceDependency.upsert({
      where: {
        sourceService_targetService_dependencyType: {
          sourceService: dep.sourceService,
          targetService: dep.targetService,
          dependencyType: 'http',
        },
      },
      create: {
        sourceService: dep.sourceService,
        targetService: dep.targetService,
        dependencyType: 'http',
        domain: 'SYSTEM',
        isCritical: dep.isCritical,
      },
      update: { isCritical: dep.isCritical },
    });
  }

  const infraEnvironments: Array<{ code: string; name: string; isActive?: boolean }> = [
    { code: 'LOCAL', name: 'Local Development' },
    { code: 'DEVELOPMENT', name: 'Development' },
    { code: 'QA', name: 'Quality Assurance' },
    { code: 'TESTING', name: 'Testing' },
    { code: 'STAGING', name: 'Staging' },
    { code: 'PRODUCTION', name: 'Production' },
    { code: 'DISASTER_RECOVERY', name: 'Disaster Recovery', isActive: false },
  ];

  for (const env of infraEnvironments) {
    await prisma.infraEnvironment.upsert({
      where: { code: env.code as never },
      create: {
        code: env.code as never,
        name: env.name,
        isActive: env.isActive ?? true,
        config: { region: 'local', cluster: 'auvora-local' },
      },
      update: { name: env.name, isActive: env.isActive ?? true },
    });
  }

  const featureFlags = [
    {
      code: 'infra.canary_deployments',
      description: 'Enable canary deployment strategy',
      enabled: true,
      environmentCode: 'STAGING' as const,
    },
    {
      code: 'infra.auto_backup_verify',
      description: 'Automatically verify backup checksums after completion',
      enabled: true,
      environmentCode: 'PRODUCTION' as const,
    },
    {
      code: 'infra.drill_notifications',
      description: 'Send notifications when recovery drills start',
      enabled: false,
      environmentCode: null,
    },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { code: flag.code },
      create: {
        code: flag.code,
        description: flag.description,
        enabled: flag.enabled,
        environmentCode: flag.environmentCode as never,
      },
      update: {
        description: flag.description,
        enabled: flag.enabled,
        environmentCode: flag.environmentCode as never,
      },
    });
  }

  const localDeploymentStartedAt = new Date(Date.now() - 86_400_000);
  await prisma.infraDeployment.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      environmentCode: 'LOCAL',
      version: '1.2.0',
      strategy: 'ROLLING',
      status: 'SUCCEEDED',
      startedAt: localDeploymentStartedAt,
      completedAt: new Date(localDeploymentStartedAt.getTime() + 120_000),
      notes: 'Phase 12 infrastructure platform seed deployment',
    },
    update: {
      version: '1.2.0',
      status: 'SUCCEEDED',
    },
  });

  await prisma.infraBackupJob.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      environmentCode: 'LOCAL',
      componentKind: 'DATABASE',
      componentName: 'auvora-postgres',
      status: 'SUCCEEDED',
      startedAt: new Date(Date.now() - 3_600_000),
      completedAt: new Date(Date.now() - 3_540_000),
      location: 's3://auvora-local-backups/postgres/2026-07-26.dump',
      checksum: 'sha256:seed-backup-checksum',
    },
    update: {
      status: 'SUCCEEDED',
      location: 's3://auvora-local-backups/postgres/2026-07-26.dump',
    },
  });

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
      ...(process.env['SEED_FORCE_ADMIN_PASSWORD'] === 'true' ? { passwordHash } : {}),
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
      version: '1.2.0',
      adminEmail,
      adminUsername,
      // Intentionally omit password from logs.
      passwordFingerprint: createHash('sha256').update(adminPassword).digest('hex').slice(0, 8),
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
