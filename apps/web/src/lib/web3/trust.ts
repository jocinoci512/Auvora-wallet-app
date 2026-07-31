import { DEMO_DAPPS } from './demo';
import { highestPermissionRisk, permissionsCanMoveFunds, type PermissionRisk } from './permissions';

export type TrustFlag = {
  id:
    | 'verified-domain'
    | 'https'
    | 'previously-connected'
    | 'known-project'
    | 'unknown-application'
    | 'newly-seen-domain';
  label: string;
  present: boolean;
};

export type TrustAssessment = {
  flags: TrustFlag[];
  /** Only true when a catalog verification flag is present — never invent “verified safe”. */
  hasVerifiedDomain: boolean;
  summary: string;
  lookalikeHint: string | null;
  riskNotes: string[];
  overallRisk: PermissionRisk;
};

type KnownEntry = { name: string; originHost: string; verified: boolean };

const KNOWN_CATALOG: KnownEntry[] = [
  { name: 'Uniswap', originHost: 'app.uniswap.org', verified: true },
  { name: 'Aave', originHost: 'app.aave.com', verified: true },
  { name: 'Snapshot', originHost: 'snapshot.org', verified: true },
  { name: 'Dune', originHost: 'dune.com', verified: true },
  { name: 'Lens', originHost: 'hey.xyz', verified: false },
];

/** Explicit typo / phishing hosts used in preview heuristics and demos. */
const LOOKALIKE_HOSTS: Record<string, string> = {
  'unlswap.org': 'app.uniswap.org',
  'www.unlswap.org': 'app.uniswap.org',
  'app.unlswap.org': 'app.uniswap.org',
  'uniswaap.org': 'app.uniswap.org',
  'app.uniswaap.org': 'app.uniswap.org',
  'uniswap.com': 'app.uniswap.org',
  'app.aavee.com': 'app.aave.com',
  'aavee.com': 'app.aave.com',
};

function hostOf(origin: string): string | null {
  try {
    const url = new URL(origin.includes('://') ? origin : `https://${origin}`);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

function isHttps(origin: string): boolean {
  try {
    const url = new URL(origin.includes('://') ? origin : `https://${origin}`);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function lookupKnownDapp(origin: string): KnownEntry | null {
  const host = hostOf(origin);
  if (!host) return null;
  for (const entry of KNOWN_CATALOG) {
    // Exact host only — do not trust arbitrary subdomains of catalog hosts.
    if (host === entry.originHost) return entry;
  }
  // Fall back to hub catalog cards (exact origin host)
  const card = DEMO_DAPPS.find((d) => hostOf(d.origin) === host);
  if (!card) return null;
  const h = hostOf(card.origin);
  if (!h) return null;
  return { name: card.name, originHost: h, verified: card.verified };
}

function registrable(host: string): string {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

export function lookalikeHint(origin: string): string | null {
  const host = hostOf(origin);
  if (!host) return null;
  if (lookupKnownDapp(origin)) return null;

  const mapped = LOOKALIKE_HOSTS[host];
  if (mapped) {
    const known = KNOWN_CATALOG.find((e) => e.originHost === mapped);
    return `This address looks similar to ${known?.name ?? mapped} (${mapped}). Double-check before connecting.`;
  }

  for (const entry of KNOWN_CATALOG) {
    const dist =
      Math.min(
        levenshtein(host, entry.originHost),
        levenshtein(registrable(host), registrable(entry.originHost)),
      ) || 99;
    if (dist > 0 && dist <= 2) {
      return `This address looks similar to ${entry.name} (${entry.originHost}). Double-check before connecting.`;
    }
  }
  return null;
}

export function assessTrust(input: {
  origin: string;
  permissions?: string[];
  previouslyConnected?: boolean;
  newlyConnected?: boolean;
  pendingRequestCount?: number;
}): TrustAssessment {
  const known = lookupKnownDapp(input.origin);
  const https = isHttps(input.origin);
  const verified = Boolean(known?.verified);
  const previously = Boolean(input.previouslyConnected);
  const knownProject = known != null;

  const flags: TrustFlag[] = [
    { id: 'verified-domain', label: 'In Auvora catalog (not attestation)', present: verified },
    { id: 'https', label: 'HTTPS', present: https },
    { id: 'previously-connected', label: 'Previously connected', present: previously },
    { id: 'known-project', label: 'Known project (catalog)', present: knownProject && !verified },
    {
      id: 'unknown-application',
      label: 'Unknown application',
      present: !knownProject && !previously,
    },
    {
      id: 'newly-seen-domain',
      label: 'Newly seen domain',
      present: Boolean(input.newlyConnected) || (!knownProject && !previously),
    },
  ];

  const present = flags.filter(
    (f) => f.present && f.id !== 'unknown-application' && f.id !== 'newly-seen-domain',
  );
  const cautionFlags = flags.filter(
    (f) => f.present && (f.id === 'unknown-application' || f.id === 'newly-seen-domain'),
  );
  const summary =
    present.length === 0 && cautionFlags.length > 0
      ? 'We can’t verify this site yet. Why: no catalog entry or prior connection for this origin.'
      : present.length === 0
        ? 'We can’t verify this site yet.'
        : verified
          ? 'Catalog verification signals are present — still review permissions before approving.'
          : 'Some trust signals are present, but this site is not marked verified-safe.';

  const riskNotes: string[] = [];
  const hint = lookalikeHint(input.origin);
  if (hint) riskNotes.push(hint);
  if (!knownProject) {
    riskNotes.push(
      'Unknown application — why this warning appears: the origin is not in the Auvora known-project catalog.',
    );
  }
  if (input.newlyConnected || (!knownProject && !previously)) {
    riskNotes.push(
      'Newly seen domain — why this warning appears: we have no prior connection history for this site.',
    );
  }
  if (input.permissions && permissionsCanMoveFunds(input.permissions)) {
    riskNotes.push(
      'This permission allows future spending requests until revoked — you still confirm each transaction.',
    );
  }
  if ((input.pendingRequestCount ?? 0) > 1) {
    riskNotes.push('Multiple pending requests — review each one separately.');
  }

  const overallRisk = input.permissions
    ? highestPermissionRisk(input.permissions)
    : riskNotes.length
      ? 'medium'
      : 'low';

  return {
    flags,
    hasVerifiedDomain: verified,
    summary,
    lookalikeHint: hint,
    riskNotes,
    overallRisk,
  };
}
