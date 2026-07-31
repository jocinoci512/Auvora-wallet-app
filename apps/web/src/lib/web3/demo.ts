import { highestPermissionRisk, permissionRiskFor, type DappPermissionCode } from './permissions';

export type DappCategory =
  | 'DeFi'
  | 'Gaming'
  | 'Social'
  | 'DAO'
  | 'Infrastructure'
  | 'Analytics'
  | 'Developer Tools'
  | 'Education';

export type DappCard = {
  id: string;
  name: string;
  origin: string;
  url: string;
  category: DappCategory;
  network: string;
  verified: boolean;
  description: string;
  trending?: boolean;
  featured?: boolean;
  risk: 'low' | 'medium' | 'elevated';
};

export type ConnectionMethod =
  'walletConnectUri' | 'qr' | 'deepLink' | 'desktopPairing' | 'mobilePairing' | 'browser';

export type ConnectionRequest = {
  id: string;
  origin: string;
  name: string;
  networks: string[];
  permissions: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  method?: ConnectionMethod;
  account?: string;
  https?: boolean;
};

export type PermissionGrant = {
  id: string;
  origin: string;
  account: string;
  permission: string;
  network: string;
  lastActivity: string;
  risk: 'low' | 'medium' | 'elevated';
};

export type Web3ActivityItem = {
  id: string;
  kind: 'connected' | 'signature' | 'transaction' | 'permission' | 'network' | 'security';
  title: string;
  detail: string;
  origin?: string;
  timestamp: string;
  status: 'confirmed' | 'pending' | 'rejected';
};

export type SignPreview = {
  kind: 'message' | 'typed' | 'transaction';
  summary: string;
  risk: 'low' | 'medium' | 'elevated';
  network: string;
  gasEstimate?: string;
  feeBreakdown?: string;
  simulation?: string;
  payloadPreview: string;
  /** True when simulation is local preview, not live chain state. */
  simulationPreview?: boolean;
};

/** WalletConnect-shaped desktop pairing fixture (preview — not a live relay session). */
export type PairingPreview = {
  method: ConnectionMethod;
  uri: string;
  pairCode: string;
  deepLink: string;
  qrPayload: string;
  expiresAt: string;
  preview: true;
  networks: string[];
  account: string;
};

export const DEMO_DAPPS: DappCard[] = [
  {
    id: 'uniswap',
    name: 'Uniswap',
    origin: 'https://app.uniswap.org',
    url: 'https://app.uniswap.org',
    category: 'DeFi',
    network: 'ETHEREUM',
    verified: true,
    featured: true,
    trending: true,
    description: 'Swap and provide liquidity across Ethereum networks.',
    risk: 'low',
  },
  {
    id: 'aave',
    name: 'Aave',
    origin: 'https://app.aave.com',
    url: 'https://app.aave.com',
    category: 'DeFi',
    network: 'ETHEREUM',
    verified: true,
    trending: true,
    description: 'Supply and borrow with transparent risk parameters.',
    risk: 'low',
  },
  {
    id: 'snapshot',
    name: 'Snapshot',
    origin: 'https://snapshot.org',
    url: 'https://snapshot.org',
    category: 'DAO',
    network: 'ETHEREUM',
    verified: true,
    description: 'Off-chain voting for DAO governance.',
    risk: 'low',
  },
  {
    id: 'lens',
    name: 'Lens',
    origin: 'https://hey.xyz',
    url: 'https://hey.xyz',
    category: 'Social',
    network: 'POLYGON',
    verified: false,
    description: 'Social graph experiences on Polygon.',
    risk: 'medium',
  },
  {
    id: 'axl',
    name: 'Axie (placeholder)',
    origin: 'https://app.axieinfinity.com',
    url: 'https://app.axieinfinity.com',
    category: 'Gaming',
    network: 'ETHEREUM',
    verified: false,
    description: 'Gaming discovery placeholder — collectibles marketplaces are out of scope.',
    risk: 'medium',
  },
  {
    id: 'dune',
    name: 'Dune',
    origin: 'https://dune.com',
    url: 'https://dune.com',
    category: 'Analytics',
    network: 'ETHEREUM',
    verified: true,
    featured: true,
    description: 'On-chain analytics and dashboards.',
    risk: 'low',
  },
  {
    id: 'remix',
    name: 'Remix',
    origin: 'https://remix.ethereum.org',
    url: 'https://remix.ethereum.org',
    category: 'Developer Tools',
    network: 'ETHEREUM',
    verified: true,
    description: 'Smart contract IDE for Ethereum.',
    risk: 'elevated',
  },
  {
    id: 'learnweb3',
    name: 'LearnWeb3',
    origin: 'https://learnweb3.io',
    url: 'https://learnweb3.io',
    category: 'Education',
    network: 'ETHEREUM',
    verified: false,
    description: 'Educational tracks for builders.',
    risk: 'low',
  },
  {
    id: 'infra',
    name: 'Alchemy Dashboard',
    origin: 'https://dashboard.alchemy.com',
    url: 'https://dashboard.alchemy.com',
    category: 'Infrastructure',
    network: 'ETHEREUM',
    verified: true,
    description: 'RPC and infra tooling for builders.',
    risk: 'low',
  },
];

export const DEMO_CATEGORIES: DappCategory[] = [
  'DeFi',
  'Gaming',
  'Social',
  'DAO',
  'Infrastructure',
  'Analytics',
  'Developer Tools',
  'Education',
];

const WC_URI =
  'wc:7f3a9c2e1b4d6a80@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export const DEMO_PAIRING: PairingPreview = {
  method: 'desktopPairing',
  uri: WC_URI,
  pairCode: 'AUV-7K2M',
  deepLink: `auvora://wc?uri=${encodeURIComponent(WC_URI)}`,
  qrPayload: WC_URI,
  expiresAt: '2026-07-30T12:00:00.000Z',
  preview: true,
  networks: ['ETHEREUM'],
  account: '0x1111…1111',
};

export const DEMO_REQUESTS: ConnectionRequest[] = [
  {
    id: 'req-1',
    origin: 'https://app.uniswap.org',
    name: 'Uniswap',
    networks: ['ETHEREUM', 'POLYGON'],
    permissions: ['VIEW_ADDRESSES', 'VIEW_BALANCES', 'REQUEST_TRANSACTIONS', 'NETWORK_SWITCH'],
    status: 'pending',
    createdAt: '2026-07-27T16:00:00.000Z',
    method: 'desktopPairing',
    account: '0x1111…1111',
    https: true,
  },
  {
    id: 'req-2',
    origin: 'https://unlswap.org',
    name: 'Unlswap (lookalike preview)',
    networks: ['ETHEREUM'],
    permissions: ['VIEW_ADDRESSES', 'REQUEST_SIGNATURES', 'REQUEST_TRANSACTIONS', 'SESSION_MANAGE'],
    status: 'pending',
    createdAt: '2026-07-27T16:05:00.000Z',
    method: 'walletConnectUri',
    account: '0x1111…1111',
    https: true,
  },
];

export const DEMO_PERMISSIONS: PermissionGrant[] = [
  {
    id: 'p1',
    origin: 'https://app.uniswap.org',
    account: '0x1111…1111',
    permission: 'REQUEST_TRANSACTIONS' satisfies DappPermissionCode,
    network: 'ETHEREUM',
    lastActivity: '2026-07-26T12:00:00.000Z',
    risk: permissionRiskFor('REQUEST_TRANSACTIONS'),
  },
  {
    id: 'p1b',
    origin: 'https://app.uniswap.org',
    account: '0x1111…1111',
    permission: 'VIEW_ADDRESSES',
    network: 'ETHEREUM',
    lastActivity: '2026-07-26T12:00:00.000Z',
    risk: permissionRiskFor('VIEW_ADDRESSES'),
  },
  {
    id: 'p1c',
    origin: 'https://app.uniswap.org',
    account: '0x1111…1111',
    permission: 'NETWORK_SWITCH',
    network: 'POLYGON',
    lastActivity: '2026-07-26T11:00:00.000Z',
    risk: permissionRiskFor('NETWORK_SWITCH'),
  },
  {
    id: 'p2',
    origin: 'https://opensea.io',
    account: '0x1111…1111',
    permission: 'VIEW_ADDRESSES',
    network: 'ETHEREUM',
    lastActivity: '2026-07-25T09:00:00.000Z',
    risk: permissionRiskFor('VIEW_ADDRESSES'),
  },
  {
    id: 'p3',
    origin: 'https://app.aave.com',
    account: '0x1111…1111',
    permission: 'REQUEST_SIGNATURES',
    network: 'ETHEREUM',
    lastActivity: '2026-07-20T18:00:00.000Z',
    risk: permissionRiskFor('REQUEST_SIGNATURES'),
  },
  {
    id: 'p3b',
    origin: 'https://app.aave.com',
    account: '0x1111…1111',
    permission: 'VIEW_BALANCES',
    network: 'ETHEREUM',
    lastActivity: '2026-07-20T18:00:00.000Z',
    risk: permissionRiskFor('VIEW_BALANCES'),
  },
];

export const DEMO_ACTIVITY: Web3ActivityItem[] = [
  {
    id: 'wa1',
    kind: 'connected',
    title: 'Connected to Uniswap',
    detail: 'Approved View addresses · Request transactions · Switch networks',
    origin: 'https://app.uniswap.org',
    timestamp: '2026-07-26T12:05:00.000Z',
    status: 'confirmed',
  },
  {
    id: 'wa2',
    kind: 'signature',
    title: 'Signed typed data',
    detail: 'Permit2 allowance · Ethereum',
    origin: 'https://app.uniswap.org',
    timestamp: '2026-07-26T12:06:00.000Z',
    status: 'confirmed',
  },
  {
    id: 'wa3',
    kind: 'network',
    title: 'Network switch',
    detail: 'Ethereum → Polygon',
    origin: 'https://app.uniswap.org',
    timestamp: '2026-07-24T10:00:00.000Z',
    status: 'confirmed',
  },
  {
    id: 'wa4',
    kind: 'permission',
    title: 'Permission revoked',
    detail: 'Request signatures removed for Aave',
    origin: 'https://app.aave.com',
    timestamp: '2026-07-20T19:00:00.000Z',
    status: 'confirmed',
  },
  {
    id: 'wa5',
    kind: 'security',
    title: 'Lookalike domain warning (preview)',
    detail:
      'Flagged https://unlswap.org as similar to Uniswap — request stayed pending for manual review (not auto-blocked)',
    origin: 'https://unlswap.org',
    timestamp: '2026-07-18T08:00:00.000Z',
    status: 'pending',
  },
  {
    id: 'wa6',
    kind: 'connected',
    title: 'Desktop pairing started',
    detail: 'WalletConnect-shaped URI preview · pair code AUV-7K2M',
    origin: 'https://app.uniswap.org',
    timestamp: '2026-07-27T16:00:00.000Z',
    status: 'pending',
  },
];

export const DEMO_SIGN: SignPreview = {
  kind: 'transaction',
  summary: 'Swap 0.25 ETH for USDC on Uniswap',
  risk: 'medium',
  network: 'ETHEREUM',
  gasEstimate: '~0.0021 ETH',
  feeBreakdown: 'Network fee 0.0018 · Priority 0.0003',
  simulation: 'Preview simulation — not live chain state. Expected out ≥ 840 USDC.',
  simulationPreview: true,
  payloadPreview: JSON.stringify(
    {
      to: '0xUniswapRouter',
      value: '250000000000000000',
      data: '0x…',
    },
    null,
    2,
  ),
};

export function riskLabel(risk: 'low' | 'medium' | 'elevated'): string {
  if (risk === 'elevated') return 'Elevated risk';
  if (risk === 'medium') return 'Review carefully';
  return 'Standard risk';
}

export function connectionMethodLabel(method?: ConnectionMethod): string {
  switch (method) {
    case 'walletConnectUri':
      return 'WalletConnect URI';
    case 'qr':
      return 'QR code';
    case 'deepLink':
      return 'Deep link';
    case 'desktopPairing':
      return 'Desktop pairing';
    case 'mobilePairing':
      return 'Mobile pairing';
    case 'browser':
      return 'In-app browser';
    default:
      return 'Connection request';
  }
}

/** Risk derived from permission codes for grants missing an explicit risk. */
export function grantRiskFromPermission(permission: string): PermissionGrant['risk'] {
  return permissionRiskFor(permission);
}

export function requestOverallRisk(permissions: string[]): PermissionGrant['risk'] {
  return highestPermissionRisk(permissions);
}
