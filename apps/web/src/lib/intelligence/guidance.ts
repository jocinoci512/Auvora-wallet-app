/**
 * Auvora Intelligence — on-device guidance helpers (web).
 * Educational only. Never investment advice. Instant local catalog.
 */

export type GuidanceLevel = 'minimal' | 'balanced' | 'full';

export type IntelligencePrefs = {
  guidanceLevel: GuidanceLevel;
  educationalHints: boolean;
  /** Off by default — no wallet data to external AI without consent. */
  allowExternalAi: boolean;
  dismissedTipIds: string[];
};

const INTEL_KEY = 'auvora_intelligence_v1';

const DEFAULTS: IntelligencePrefs = {
  guidanceLevel: 'balanced',
  educationalHints: true,
  allowExternalAi: false,
  dismissedTipIds: [],
};

export function getIntelligencePrefs(): IntelligencePrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(INTEL_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<IntelligencePrefs>;
    return {
      ...DEFAULTS,
      ...parsed,
      dismissedTipIds: Array.isArray(parsed.dismissedTipIds) ? parsed.dismissedTipIds : [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setIntelligencePrefs(patch: Partial<IntelligencePrefs>): IntelligencePrefs {
  const next = { ...getIntelligencePrefs(), ...patch };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(INTEL_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function shouldShowEducationalHints(prefs = getIntelligencePrefs()): boolean {
  return prefs.educationalHints && prefs.guidanceLevel !== 'minimal';
}

export type SearchAssistHit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
};

export const SEARCH_ASSIST_INDEX: SearchAssistHit[] = [
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Account, appearance, notifications, privacy',
    href: '/settings',
    keywords: ['settings', 'preferences', 'account'],
  },
  {
    id: 'security',
    title: 'Security Center',
    subtitle: 'PIN, biometrics, recovery, protection',
    href: '/security',
    keywords: ['security', 'pin', 'biometric', 'recovery', 'phrase'],
  },
  {
    id: 'permissions',
    title: 'Permission Center',
    subtitle: 'Connected apps and approvals',
    href: '/web3/permissions',
    keywords: ['permissions', 'dapp', 'web3', 'connection'],
  },
  {
    id: 'learn',
    title: 'Learning Center',
    subtitle: 'Short lessons on fees, keys, and networks',
    href: '/learn',
    keywords: ['learn', 'lesson', 'gas', 'fee', 'bridge', 'stake', 'help'],
  },
  {
    id: 'insights',
    title: 'Insights',
    subtitle: 'Educational portfolio notes — not advice',
    href: '/insights',
    keywords: ['insights', 'portfolio', 'summary'],
  },
  {
    id: 'guidance',
    title: 'Guidance & privacy',
    subtitle: 'How much Intelligence to show',
    href: '/settings/privacy',
    keywords: ['guidance', 'intelligence', 'tips', 'ai'],
  },
  {
    id: 'support',
    title: 'Help & support',
    subtitle: 'FAQ and contact paths',
    href: '/settings/help',
    keywords: ['help', 'support', 'faq'],
  },
  {
    id: 'activity',
    title: 'Activity',
    subtitle: 'Transaction history',
    href: '/activity',
    keywords: ['activity', 'history', 'transactions', 'pending'],
  },
];

export function searchAssist(query: string): SearchAssistHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_ASSIST_INDEX.filter((hit) => {
    if (hit.title.toLowerCase().includes(q) || hit.subtitle.toLowerCase().includes(q)) return true;
    return hit.keywords.some((k) => k.includes(q) || q.includes(k));
  });
}

export type Explanation = {
  title: string;
  whatHappened: string;
  whyItMatters: string;
  whatYouCanDo: string;
};

export function explainNetworkState(opts: {
  offline?: boolean;
  syncDelayed?: boolean;
}): Explanation {
  if (opts.offline) {
    return {
      title: 'You appear offline',
      whatHappened: 'This browser cannot reach the network right now.',
      whyItMatters: 'Cached figures may be outdated until you reconnect.',
      whatYouCanDo: 'Reconnect, then refresh. Sending needs a live network.',
    };
  }
  if (opts.syncDelayed) {
    return {
      title: 'Sync is slower than usual',
      whatHappened: 'Network health looks busy or degraded.',
      whyItMatters: 'Balances and fees may update late; congestion can raise fees.',
      whatYouCanDo: 'Wait and refresh. Non-urgent transfers can wait for quieter fees.',
    };
  }
  return {
    title: 'Networks look reachable',
    whatHappened: 'Health checks did not flag an outage.',
    whyItMatters: 'You can refresh balances and continue normal use.',
    whatYouCanDo: 'If something still looks wrong, refresh or open Advanced diagnostics.',
  };
}

export const GUIDANCE_DISCLAIMER =
  'Educational guidance only. Auvora never recommends buying, selling, or trading.';
