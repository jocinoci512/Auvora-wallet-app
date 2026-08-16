import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthStatusExperience } from '../../../components/auth/AuthStatusExperience';

export const metadata: Metadata = {
  title: 'Account suspended',
  robots: { index: false, follow: false },
};

export default function AccountSuspendedPage(): ReactElement {
  return <AuthStatusExperience status="suspended" />;
}
