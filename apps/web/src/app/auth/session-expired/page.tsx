import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthStatusExperience } from '../../../components/auth/AuthStatusExperience';

export const metadata: Metadata = {
  title: 'Session expired',
  robots: { index: false, follow: false },
};

export default function SessionExpiredPage(): ReactElement {
  return <AuthStatusExperience status="expired" />;
}
