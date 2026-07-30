import type { PermissionGrant } from './demo';
import { DEMO_PERMISSIONS } from './demo';
import {
  formatPermissionList,
  highestPermissionRisk,
  permissionTitle,
  type DappPermissionCode,
  type PermissionRisk,
} from './permissions';
import { lookupKnownDapp } from './trust';

/** Connected-app session shape shared by /web3/permissions and settings dApps. */
export type ConnectedAppSession = {
  id: string;
  name: string;
  origin: string;
  networks: string[];
  accounts: string[];
  permissions: string[];
  lastActivity: string;
  risk: PermissionRisk;
  previouslyConnected: boolean;
};

export type ConnectedDappRow = {
  id: string;
  name: string;
  origin: string;
  network: string;
  permissions: number;
  permissionCodes: string[];
  permissionLabels: string;
  lastActivity: string;
  risk: PermissionRisk;
};

function nameForOrigin(origin: string): string {
  const known = lookupKnownDapp(origin);
  if (known) return known.name;
  try {
    return new URL(origin).hostname.replace(/^www\./, '');
  } catch {
    return origin;
  }
}

/** Group flat permission grants into one session row per origin. */
export function sessionsFromGrants(grants: PermissionGrant[]): ConnectedAppSession[] {
  const byOrigin = new Map<
    string,
    {
      permissions: string[];
      networks: Set<string>;
      accounts: Set<string>;
      lastActivity: string;
      ids: string[];
    }
  >();

  for (const g of grants) {
    const cur = byOrigin.get(g.origin) ?? {
      permissions: [],
      networks: new Set<string>(),
      accounts: new Set<string>(),
      lastActivity: g.lastActivity,
      ids: [],
    };
    if (!cur.permissions.includes(g.permission)) cur.permissions.push(g.permission);
    cur.networks.add(g.network);
    cur.accounts.add(g.account);
    cur.ids.push(g.id);
    if (g.lastActivity > cur.lastActivity) cur.lastActivity = g.lastActivity;
    byOrigin.set(g.origin, cur);
  }

  return [...byOrigin.entries()]
    .map(([origin, cur]) => ({
      id: `session-${cur.ids[0] ?? origin}`,
      name: nameForOrigin(origin),
      origin,
      networks: [...cur.networks],
      accounts: [...cur.accounts],
      permissions: cur.permissions,
      lastActivity: cur.lastActivity,
      risk: highestPermissionRisk(cur.permissions),
      previouslyConnected: true,
    }))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

export function sessionToRow(session: ConnectedAppSession): ConnectedDappRow {
  return {
    id: session.id,
    name: session.name,
    origin: session.origin,
    network: session.networks[0] ?? 'ETHEREUM',
    permissions: session.permissions.length,
    permissionCodes: session.permissions,
    permissionLabels: formatPermissionList(session.permissions),
    lastActivity: session.lastActivity,
    risk: session.risk,
  };
}

export function demoConnectedSessions(): ConnectedAppSession[] {
  return sessionsFromGrants(DEMO_PERMISSIONS);
}

export function demoConnectedRows(): ConnectedDappRow[] {
  return demoConnectedSessions().map(sessionToRow);
}

export function grantLabels(codes: Iterable<string>): string {
  return [...codes].map((c) => permissionTitle(c as DappPermissionCode)).join(', ');
}
