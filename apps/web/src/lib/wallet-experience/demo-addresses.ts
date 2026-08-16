import type { WalletNetwork } from './types';

/** Public demo receive addresses — never treat as live funding destinations. */
export const DEMO_RECEIVE_ADDRESSES: Record<WalletNetwork, string> = {
  bitcoin: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ethereum: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  solana: '7EqQdEULxWcraVx1VfyQW9XbnAHKKfwdERJXNqTUHxN',
  polygon: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  bnb: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  tron: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
};
