/**
 * Auvora company voice — Phase 10 brand consistency.
 * Prefer these terms in product copy. Do not invent parallel jargon.
 */

export const AUVORA_VOICE = {
  brand: 'Auvora',
  product: 'Auvora Wallet',
  tone: ['calm', 'precise', 'honest', 'non-alarmist'] as const,
  neverSay: ['guaranteed returns', 'risk-free', 'financial advice', 'seed phrase in chat'] as const,
  prefer: {
    preview: 'Preview / simulator — not on-chain until connected',
    recoveryPhrase: 'recovery phrase',
    networkFee: 'network fee',
    confirm: 'Review before you confirm',
  },
} as const;

export const LEGAL_DISCLAIMER =
  'This page is a product transparency draft for engineering preview. Counsel must publish final Privacy Policy and Terms before public GA.';
