/** Canonical dApp permission codes — aligned with connections service + mobile catalog. */
export const DAPP_PERMISSION_CODES = [
  'VIEW_ADDRESSES',
  'VIEW_BALANCES',
  'REQUEST_SIGNATURES',
  'REQUEST_TRANSACTIONS',
  'NETWORK_SWITCH',
  'SESSION_MANAGE',
] as const;

export type DappPermissionCode = (typeof DAPP_PERMISSION_CODES)[number];

export type PermissionRisk = 'low' | 'medium' | 'elevated';

export type PermissionInfo = {
  code: DappPermissionCode;
  title: string;
  explanation: string;
  risk: PermissionRisk;
  canMoveFunds: boolean;
};

/** Plain-language catalog mirroring mobile `permission_catalog.dart`. */
export const PERMISSION_CATALOG: Record<DappPermissionCode, PermissionInfo> = {
  VIEW_ADDRESSES: {
    code: 'VIEW_ADDRESSES',
    title: 'View your wallet address',
    explanation:
      'This app can see your wallet address on the networks you approve so it can recognize your account.',
    risk: 'low',
    canMoveFunds: false,
  },
  VIEW_BALANCES: {
    code: 'VIEW_BALANCES',
    title: 'View your balances',
    explanation:
      'This app can read token balances for accounts you connect. It cannot move funds with this permission alone.',
    risk: 'low',
    canMoveFunds: false,
  },
  REQUEST_SIGNATURES: {
    code: 'REQUEST_SIGNATURES',
    title: 'Ask you to sign messages',
    explanation:
      'This app can ask you to sign messages. Signing does not always move funds, but some signatures (like Permit or allowance approvals) can authorize spending later. You still approve each signature.',
    risk: 'medium',
    canMoveFunds: false,
  },
  REQUEST_TRANSACTIONS: {
    code: 'REQUEST_TRANSACTIONS',
    title: 'Ask you to approve transactions',
    explanation:
      'This app can ask you to send transactions. You still approve each one, and approved sends can move funds or assets.',
    risk: 'elevated',
    canMoveFunds: true,
  },
  NETWORK_SWITCH: {
    code: 'NETWORK_SWITCH',
    title: 'Suggest a network change',
    explanation:
      'This app may ask you to switch networks. You stay in control of whether the switch happens.',
    risk: 'medium',
    canMoveFunds: false,
  },
  SESSION_MANAGE: {
    code: 'SESSION_MANAGE',
    title: 'Keep a connected session',
    explanation:
      'This app wants to stay connected so you do not have to reconnect every visit. You can disconnect anytime.',
    risk: 'low',
    canMoveFunds: false,
  },
};

const RISK_RANK: Record<PermissionRisk, number> = { low: 0, medium: 1, elevated: 2 };

export function isDappPermissionCode(value: string): value is DappPermissionCode {
  return (DAPP_PERMISSION_CODES as readonly string[]).includes(value);
}

export function permissionInfoFor(code: string): PermissionInfo | null {
  if (!isDappPermissionCode(code)) return null;
  return PERMISSION_CATALOG[code];
}

export function permissionTitle(code: string): string {
  return permissionInfoFor(code)?.title ?? code;
}

export function permissionRiskFor(code: string): PermissionRisk {
  return permissionInfoFor(code)?.risk ?? 'medium';
}

export function highestPermissionRisk(codes: Iterable<string>): PermissionRisk {
  let highest: PermissionRisk = 'low';
  for (const code of codes) {
    const risk = permissionRiskFor(code);
    if (RISK_RANK[risk] > RISK_RANK[highest]) highest = risk;
  }
  return highest;
}

export function permissionsCanMoveFunds(codes: Iterable<string>): boolean {
  for (const code of codes) {
    if (permissionInfoFor(code)?.canMoveFunds) return true;
  }
  return false;
}

export function formatPermissionList(codes: Iterable<string>): string {
  return [...codes].map(permissionTitle).join(' · ');
}
