import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { DashboardExperience } from '../../components/dashboard/DashboardExperience';

export const metadata: Metadata = {
  title: 'App',
  description: 'Auvora Wallet application dashboard',
  robots: { index: false, follow: true },
};

export default function DashboardPage(): ReactElement {
  return <DashboardExperience />;
}
