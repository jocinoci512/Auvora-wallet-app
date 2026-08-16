import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthStatusExperience } from '../../../components/auth/AuthStatusExperience';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage(): ReactElement {
  return <AuthStatusExperience status="offline" />;
}
