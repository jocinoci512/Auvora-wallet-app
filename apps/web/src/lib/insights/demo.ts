/**
 * Phase 7 — Smart portfolio insights, health score, learn topics, assistant replies.
 * Demo / client-side only. Never sends private keys. Educational — not financial advice.
 */

import { DEMO_HOLDINGS, portfolioTotals, type Holding } from '../dashboard-demo';
import { getBackupPrefs } from '../settings/prefs';
import { getSecurityPrefs } from '../wallet-experience/security-prefs';

export type PortfolioHealthFactor = {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
  why: string;
  href: string;
  action: string;
};

export type InsightKind =
  'concentration' | 'idle' | 'rewards' | 'security' | 'milestone' | 'fees' | 'tax' | 'diversify';

export type PortfolioInsight = {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  severity: 'info' | 'tip' | 'watch';
  href?: string;
  /** Human label for UI (never raw severity enums). */
  badge: string;
};

export type LearnTopic = {
  id: string;
  category: string;
  title: string;
  summary: string;
  minutes: number;
  /** Short lesson body shown in Education Hub (plain language). */
  body: string[];
  href?: string;
  hrefLabel?: string;
};

export type AssistantReply = {
  answer: string;
  related?: { label: string; href: string }[];
  /** true when answer is general education, not a portfolio fact. */
  educational?: boolean;
};

export const PERM_REVIEW_KEY = 'auvora_perm_review_v1';

export function markPermissionsReviewed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERM_REVIEW_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function hasReviewedPermissions(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(PERM_REVIEW_KEY));
  } catch {
    return false;
  }
}

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'USDP', 'BUSD']);

function severityBadge(severity: PortfolioInsight['severity']): string {
  if (severity === 'watch') return 'Worth a look';
  if (severity === 'tip') return 'Tip';
  return 'Info';
}

export function computePortfolioHealthScore(holdings: Holding[] = DEMO_HOLDINGS): {
  score: number;
  factors: PortfolioHealthFactor[];
} {
  const list = holdings.length ? holdings : [];
  const maxAlloc = list.length ? Math.max(...list.map((h) => h.allocationPct)) : 0;
  const networks = new Set(list.map((h) => h.network)).size;
  const sec = typeof window !== 'undefined' ? getSecurityPrefs() : null;
  const backup = typeof window !== 'undefined' ? getBackupPrefs() : null;
  const permsOk = hasReviewedPermissions();

  const factors: PortfolioHealthFactor[] = [
    {
      id: 'diversify',
      label: 'Diversification',
      ok: list.length >= 3 && maxAlloc < 50,
      weight: 20,
      why: 'Spreading value across assets can reduce single-token shock. Concentration can still be intentional.',
      href: '/portfolio',
      action: 'Review allocation',
    },
    {
      id: 'networks',
      label: 'Network spread',
      ok: networks >= 2,
      weight: 15,
      why: 'Multiple networks can lower dependency on one chain’s fees or outages.',
      href: '/portfolio',
      action: 'See network mix',
    },
    {
      id: 'pin',
      label: 'Wallet PIN enabled',
      ok: Boolean(sec?.pinEnabled),
      weight: 20,
      why: 'A PIN helps protect this device if someone borrows your screen.',
      href: '/security',
      action: 'Enable PIN',
    },
    {
      id: 'backup',
      label: 'Recovery verified',
      ok: Boolean(backup?.phraseVerified),
      weight: 25,
      why: 'A verified phrase is how you restore self-custody wallets after device loss.',
      href: '/settings/backup',
      action: 'Practice recovery',
    },
    {
      id: 'permissions',
      label: 'Permissions reviewed',
      ok: permsOk,
      weight: 20,
      why: 'A quick pass over dApp grants lowers approval risk. Open Permissions once to mark this done.',
      href: '/web3/permissions',
      action: 'Review permissions',
    },
  ];

  const earned = factors.reduce((s, f) => s + (f.ok ? f.weight : 0), 0);
  const max = factors.reduce((s, f) => s + f.weight, 0) || 1;
  return { score: Math.round((earned / max) * 100), factors };
}

export function buildPortfolioInsights(holdings: Holding[] = DEMO_HOLDINGS): PortfolioInsight[] {
  const list = holdings.length ? holdings : DEMO_HOLDINGS;
  const totals = portfolioTotals(list);
  const sorted = [...list].sort((a, b) => b.valueUsd - a.valueUsd);
  const top = sorted[0];
  const worst = [...list].sort((a, b) => a.change24hPct - b.change24hPct)[0];
  const best = [...list].sort((a, b) => b.change24hPct - a.change24hPct)[0];
  const insights: PortfolioInsight[] = [];
  const hasStables = list.some((h) => STABLE_SYMBOLS.has(h.symbol.toUpperCase()));
  const hasStakeable = list.some((h) =>
    ['ETH', 'SOL', 'ATOM', 'DOT'].includes(h.symbol.toUpperCase()),
  );

  function push(partial: Omit<PortfolioInsight, 'badge'>): void {
    insights.push({ ...partial, badge: severityBadge(partial.severity) });
  }

  if (top && top.allocationPct >= 35) {
    push({
      id: 'conc-1',
      kind: 'concentration',
      title: `${top.symbol} is a large share of this portfolio`,
      detail: `About ${top.allocationPct.toFixed(0)}% sits in ${top.name} (estimate from current holdings). That can be intentional — moves in ${top.symbol} simply move the total more.`,
      severity: 'watch',
      href: '/portfolio',
    });
  }

  if (best) {
    push({
      id: 'best-1',
      kind: 'milestone',
      title: `Largest 24h move: ${best.symbol}`,
      detail: `${best.name} is ${best.change24hPct >= 0 ? 'up' : 'down'} ${Math.abs(best.change24hPct).toFixed(1)}% over 24 hours (market estimate). Short swings are common; they are not a recommendation to buy or sell.`,
      severity: 'info',
      href: '/market',
    });
  }

  if (worst && worst.id !== best?.id && worst.change24hPct < -0.5) {
    push({
      id: 'worst-1',
      kind: 'diversify',
      title: `${worst.symbol} moved lower today`,
      detail: `${worst.name} is ${worst.change24hPct.toFixed(1)}% over 24 hours (market estimate). One quiet or down day is not a thesis change by itself.`,
      severity: 'tip',
      href: '/portfolio',
    });
  }

  if (hasStakeable) {
    push({
      id: 'stake-1',
      kind: 'rewards',
      title: 'Staking rewards (if you stake)',
      detail:
        'If you already stake assets like ETH or SOL, rewards can sit unclaimed. Claiming is optional and may cost a network fee. This tip is educational — not a suggestion to start staking.',
      severity: 'tip',
      href: '/staking',
    });
  }

  if (hasStables) {
    push({
      id: 'stable-1',
      kind: 'idle',
      title: 'Stablecoins in your mix',
      detail:
        'You hold stablecoins. Keeping some for spending or transfers is common. Yield products add risk — learn the trade-offs in Education before changing anything.',
      severity: 'info',
      href: '/learn',
    });
  }

  if (!hasReviewedPermissions()) {
    push({
      id: 'sec-1',
      kind: 'security',
      title: 'A permissions check helps portfolio health',
      detail:
        'PIN, recovery rehearsal, and dApp permissions protect the same assets you track here. Open Permissions when you have a minute — no rush.',
      severity: 'tip',
      href: '/web3/permissions',
    });
  }

  if (totals.unrealized !== 0) {
    push({
      id: 'tax-1',
      kind: 'tax',
      title: 'Unrealized P/L is not a tax bill',
      detail: `Illustrative unrealized P/L is about $${Math.round(Math.abs(totals.unrealized)).toLocaleString()} (${totals.unrealized >= 0 ? 'gain' : 'loss'} estimate from demo cost basis). Tax rules usually apply when you sell or swap — keep your own records. This is not tax advice.`,
      severity: 'info',
      href: '/activity',
    });
  }

  push({
    id: 'gas-1',
    kind: 'fees',
    title: 'Fee estimates before you confirm',
    detail:
      'Network fees change with demand. Auvora shows fee estimates before Send, Swap, or Bridge. Waiting or using another network can reduce cost — your choice.',
    severity: 'tip',
    href: '/send',
  });

  return insights;
}

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: 'wallet-basics',
    category: 'Wallet Basics',
    title: 'What a wallet actually holds',
    summary: 'Keys, addresses, and why Auvora never asks for your phrase in chat.',
    minutes: 4,
    body: [
      'A wallet app shows balances and helps you approve transactions. The important part is the keys that prove control of addresses on a network.',
      'Your recovery phrase can recreate those keys. Auvora will never ask for it in chat, email, or a random popup.',
      'An address is safe to share for receiving. Your phrase is never safe to share.',
    ],
    href: '/settings/help',
    hrefLabel: 'Help & FAQ',
  },
  {
    id: 'fundamentals',
    category: 'Crypto Fundamentals',
    title: 'Tokens, networks, and value',
    summary: 'How assets live on chains — without trading jargon.',
    minutes: 5,
    body: [
      'A token is a balance recorded on a network. Different networks (Bitcoin, Ethereum, Solana) use different rules and fees.',
      'Price is what the market is trading at right now. It is not a promise about tomorrow.',
      'Sending on the wrong network can permanently lose funds — always match network when you receive.',
    ],
    href: '/receive',
    hrefLabel: 'Receive guide',
  },
  {
    id: 'security',
    category: 'Security',
    title: 'PIN, lock, and recovery',
    summary: 'How device protection and phrase rehearsal work together.',
    minutes: 5,
    body: [
      'A PIN or biometrics lock this device. It does not replace your recovery phrase.',
      'Practice recovery in a guided rehearsal so you know the phrase works before you need it.',
      'Verification should follow rehearsal — not a one-tap shortcut that skips understanding.',
    ],
    href: '/settings/security',
    hrefLabel: 'Security Center',
  },
  {
    id: 'scams',
    category: 'Scam Prevention',
    title: 'Spotting phishing and fake support',
    summary: 'Red flags, address warnings, and what Auvora will never ask.',
    minutes: 6,
    body: [
      'Scammers rush you: “verify now,” “refund,” or “support needs your phrase.” Real support never needs your phrase.',
      'Check URLs carefully. Prefer bookmarks for sites you use often.',
      'On Send, pause on address warnings. On Web3, revoke grants you do not recognize.',
    ],
    href: '/assistant',
    hrefLabel: 'Ask Assistant',
  },
  {
    id: 'gas',
    category: 'Gas Fees',
    title: 'Why network fees change',
    summary: 'Slow / standard / fast fees in plain language.',
    minutes: 4,
    body: [
      'Fees pay the network to include your transaction. Busy moments cost more.',
      '“Faster” usually means a higher fee for quicker inclusion — an estimate, not a guarantee of exact timing.',
      'If a fee looks high, waiting is often fine for non-urgent transfers.',
    ],
    href: '/send',
    hrefLabel: 'Open Send',
  },
  {
    id: 'l2',
    category: 'Layer 2',
    title: 'Cheaper networks related to Ethereum',
    summary: 'What L2s are for — and when bridges matter.',
    minutes: 5,
    body: [
      'Layer 2 networks aim to process activity with lower fees while settling back to a main network.',
      'Moving value between networks often uses a bridge. Compare fees and arrival time, then confirm both sides carefully.',
      'Keep receipts if a bridge looks delayed — progress is usually lock → relay → mint.',
    ],
    href: '/bridge',
    hrefLabel: 'Open Bridge',
  },
  {
    id: 'staking',
    category: 'Staking',
    title: 'What staking means',
    summary: 'Lockups, validators, and unstaking cool-downs.',
    minutes: 5,
    body: [
      'Staking can mean helping secure a network by locking assets with a validator. Rewards are not guaranteed.',
      'Unstaking often has a cool-down. Read lockup, commission, and risks before you delegate.',
      'This lesson is educational. Auvora does not recommend specific validators or APYs.',
    ],
    href: '/staking',
    hrefLabel: 'Staking',
  },
  {
    id: 'defi',
    category: 'DeFi',
    title: 'Swaps and approvals without jargon',
    summary: 'What you grant when you approve a token — and how to revoke.',
    minutes: 6,
    body: [
      'A swap trades one token for another through a route. Slippage is how much price may move before fill.',
      'An approval lets a contract spend a token up to a limit. Prefer limited approvals when you can.',
      'Revoke unused grants in Permissions. Unknown sites asking for unlimited spend are a red flag.',
    ],
    href: '/web3/permissions',
    hrefLabel: 'Permissions',
  },
  {
    id: 'networks',
    category: 'Blockchain Networks',
    title: 'Bitcoin, Ethereum, Solana — different jobs',
    summary: 'Why the wrong network can lose funds on receive.',
    minutes: 5,
    body: [
      'Each network has its own addresses and fee model. They are not interchangeable.',
      'When someone sends you assets, confirm which network they will use before sharing an address.',
      'If unsure, ask the Assistant or check Receive network labels carefully.',
    ],
    href: '/receive',
    hrefLabel: 'Receive',
  },
  {
    id: 'recovery',
    category: 'Recovery',
    title: 'Practice recovery before you need it',
    summary: 'Guided rehearsal builds muscle memory without risk.',
    minutes: 7,
    body: [
      'Write your phrase offline. Never photo it or paste it into cloud notes or chat.',
      'Use guided rehearsal in Auvora to confirm you can restore — verification follows practice.',
      'If you lose both device and phrase, self-custody funds generally cannot be recovered by support.',
    ],
    href: '/wallets/recovery',
    hrefLabel: 'Practice recovery',
  },
];

const ASSISTANT_KB: { match: RegExp; reply: AssistantReply }[] = [
  {
    match:
      /\b(should i (buy|sell|stake|invest)|what (coin|token) should|guaranteed|moon|financial advice)\b/i,
    reply: {
      educational: true,
      answer:
        'I do not give financial, investment, or tax advice, and I never recommend buying or selling a specific asset. I can explain how fees, recovery, staking, or portfolio views work so you can decide for yourself. If you are unsure, pause — there is no rush.',
      related: [
        { label: 'Education Hub', href: '/learn' },
        { label: 'Insights (educational)', href: '/insights' },
      ],
    },
  },
  {
    match: /fee|gas|gwei/i,
    reply: {
      educational: true,
      answer:
        'Network fees pay validators (or similar network participants) to include your transaction. Higher “speed” usually means a higher fee estimate and a chance of faster confirmation — timing is not guaranteed. Auvora shows fee estimates before you confirm. If Ethereum fees look high, waiting or using another network can help; that is your choice.',
      related: [
        { label: 'Send with fee options', href: '/send' },
        { label: 'Gas lesson', href: '/learn' },
      ],
    },
  },
  {
    match: /scam|phish|fake support|airdrop link/i,
    reply: {
      educational: true,
      answer:
        'Auvora will never ask for your recovery phrase in chat, email, or a dApp popup. Real support will not remote-control your wallet. If someone rushes you to “verify” by pasting a phrase — stop. Use address warnings on Send and revoke odd dApp permissions.',
      related: [
        { label: 'Security Center', href: '/settings/security' },
        { label: 'Scam lesson', href: '/learn' },
      ],
    },
  },
  {
    match: /recover|backup|seed phrase|recovery phrase/i,
    reply: {
      educational: true,
      answer:
        'Your recovery phrase can recreate self-custody keys. Practice recovery in a guided rehearsal so you know it works — never photograph it or store it in cloud notes. Auvora verification follows rehearsal; we will never ask you to paste the phrase into this chat.',
      related: [
        { label: 'Practice recovery', href: '/wallets/recovery' },
        { label: 'Backup status', href: '/settings/backup' },
      ],
    },
  },
  {
    match: /stake|staking|apy|validator/i,
    reply: {
      educational: true,
      answer:
        'Staking often means locking assets with a validator to help secure a network. Rewards are not guaranteed, and unstaking can take a cool-down. Read APY, commission, and lockup yourself before you delegate — I will not pick a validator for you.',
      related: [
        { label: 'Staking', href: '/staking' },
        { label: 'Staking lesson', href: '/learn' },
      ],
    },
  },
  {
    match: /bridge|cross.?chain/i,
    reply: {
      educational: true,
      answer:
        'A bridge moves value between networks. Compare fee estimates and arrival time, then confirm source and destination carefully. Progress usually goes lock → relay → mint. Keep the receipt if anything looks stuck.',
      related: [
        { label: 'Bridge', href: '/bridge' },
        { label: 'Layer 2 lesson', href: '/learn' },
      ],
    },
  },
  {
    match: /security|scam|phish|seed|recovery phrase/i,
    reply: {
      educational: true,
      answer:
        'Auvora support never asks for your recovery phrase. Bookmark official URLs, double-check dApp permissions, and use Security Center to review devices and hygiene tips.',
      related: [
        { label: 'Security Center', href: '/settings/security' },
        { label: 'Permissions', href: '/web3/permissions' },
      ],
    },
  },
  {
    match: /portfolio|diversif|allocat|pnl|profit|loss|concentration/i,
    reply: {
      educational: true,
      answer:
        'Smart Portfolio shows allocation, unrealized P/L estimates (when cost basis exists), and health tips. Concentration in one asset can be intentional — Insights explain what stands out without telling you to trade. Numbers labeled estimate or illustrative are not guarantees.',
      related: [
        { label: 'Smart Portfolio', href: '/portfolio' },
        { label: 'Insights', href: '/insights' },
      ],
    },
  },
  {
    match: /swap|slippage|approval/i,
    reply: {
      educational: true,
      answer:
        'A swap trades one token for another via a route. Slippage is how much price may move before fill. Approvals let a contract spend a token — review amounts and revoke unused grants in Permissions.',
      related: [
        { label: 'Swap', href: '/swap' },
        { label: 'Permissions', href: '/web3/permissions' },
      ],
    },
  },
];

export function answerAssistant(question: string): AssistantReply {
  const q = question.trim();
  if (!q) {
    return {
      educational: true,
      answer:
        'Ask about fees, recovery, staking, bridges, or portfolio concepts — in everyday language. I explain; I do not give investment advice.',
    };
  }
  for (const row of ASSISTANT_KB) {
    if (row.match.test(q)) return row.reply;
  }
  return {
    educational: true,
    answer:
      'I explain fees, security, recovery, staking, bridges, and portfolio basics in plain language. I never move funds, ask for your recovery phrase, or tell you what to buy or sell. Try: “Why are gas fees high?” or “How do I recover my wallet?”',
    related: [
      { label: 'Education Hub', href: '/learn' },
      { label: 'Insights', href: '/insights' },
      { label: 'Help', href: '/settings/help' },
    ],
  };
}

export const ASSISTANT_PROMPTS = [
  'Why are gas fees high?',
  'How do I recover my wallet?',
  'What is staking?',
  'How do bridges work?',
  'How do I spot a scam?',
  'What does portfolio concentration mean?',
];

export const DEMO_SMART_ALERTS = [
  {
    id: 'sa-in',
    title: 'Large incoming transfer',
    detail:
      'Example: 0.50 ETH received on Ethereum — review Activity if a real alert looks unexpected.',
    category: 'largeTransfers' as const,
  },
  {
    id: 'sa-out',
    title: 'Large outgoing transfer',
    detail: 'Example: a send above your usual size — verify the destination in Activity.',
    category: 'largeTransfers' as const,
  },
  {
    id: 'sa-fee',
    title: 'Elevated Ethereum fees',
    detail: 'Example: gas higher than a typical window — waiting on non-urgent sends can help.',
    category: 'highNetworkFees' as const,
  },
  {
    id: 'sa-perm',
    title: 'Review a recent approval',
    detail: 'Example: a token spend allowance changed — revoke unused grants anytime.',
    category: 'securityAlerts' as const,
  },
  {
    id: 'sa-stake',
    title: 'Staking rewards available',
    detail: 'Example: claimable rewards may exist — claiming is optional and may cost a fee.',
    category: 'stakingRewards' as const,
  },
  {
    id: 'sa-insight',
    title: 'Portfolio concentration tip',
    detail: 'Example: one asset is a large share — open Insights for a calm explanation.',
    category: 'insightAlerts' as const,
  },
  {
    id: 'sa-health',
    title: 'Portfolio health reminder',
    detail: 'Example: a recovery rehearsal would improve health score — practice when ready.',
    category: 'portfolioHealth' as const,
  },
];

export const ASSISTANT_HISTORY_KEY = 'auvora_assistant_history_v1';

export function clearAssistantHistoryStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ASSISTANT_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
