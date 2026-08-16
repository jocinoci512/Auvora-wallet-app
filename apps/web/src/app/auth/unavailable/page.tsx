import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthStatusExperience } from '../../../components/auth/AuthStatusExperience';

export const metadata: Metadata = {
  title: 'Service unavailable',
  robots: { index: false, follow: false },
};

export default function UnavailablePage(): ReactElement {
  return <AuthStatusExperience status="unavailable" />;
}
