import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { DashboardExperience } from '../../components/dashboard/DashboardExperience';

export const metadata: Metadata = {
  title: 'Wallet',
  description: 'Auvora Wallet dashboard — portfolio, assets, and activity',
  robots: { index: false, follow: true },
};

export default function DashboardPage(): ReactElement {
  return <DashboardExperience />;
}
