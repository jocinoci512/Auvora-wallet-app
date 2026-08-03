import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { MobilePairingExperience } from '../../../components/web3/MobilePairingExperience';

export const metadata: Metadata = {
  title: 'Pair mobile',
  description: 'Pair Auvora web companion with mobile via the same Reown Cloud project.',
  robots: { index: false, follow: false },
};

export default function PairPage(): ReactElement {
  return <MobilePairingExperience />;
}
