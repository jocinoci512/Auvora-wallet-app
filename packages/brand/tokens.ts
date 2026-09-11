/**
 * Official Auvora Professional Brand Kit tokens.
 * Artwork lives in ./source — do not redraw or recolor letterforms.
 */
export const brandColors = {
  deepLagoon: '#102D32',
  auvoraTeal: '#087F75',
  softMint: '#B9F4D7',
  lightBackground: '#F2F6F3',
  /** Supporting ink from email kit */
  mutedTealInk: '#49605E',
  hairline: '#DEE8E3',
} as const;

/** Production HTTPS paths once web/public/brand is deployed with the marketing site. */
export const brandAssetUrls = {
  productionOrigin: 'https://auvorawallet.com',
  primarySvg: '/brand/Auvora_Primary.svg',
  reverseSvg: '/brand/Auvora_Reverse.svg',
  monochromeSvg: '/brand/Auvora_Monochrome.svg',
  symbolSvg: '/brand/Auvora_Symbol.svg',
  appIconPng: '/brand/Auvora_App_Icon.png',
  favicon: '/brand/favicon.ico',
  icon180: '/brand/Auvora_Icon_180.png',
  icon192: '/brand/Auvora_Icon_192.png',
  icon512: '/brand/Auvora_Icon_512.png',
  /** Hosted email assets — prefer absolute HTTPS in transactional mail */
  emailLogoHttps: 'https://auvorawallet.com/brand/email/Auvora_Email_Logo.png',
  emailHeaderHttps: 'https://auvorawallet.com/brand/email/Auvora_Email_Header.png',
} as const;

export const brandNames = {
  product: 'Auvora Wallet',
  admin: 'Auvora Admin',
  team: 'Auvora Wallet Team',
} as const;
