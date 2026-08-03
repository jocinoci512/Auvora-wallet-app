import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { VerifyEmailExperience } from '../../../components/auth/VerifyEmailExperience';

export const metadata: Metadata = {
  title: 'Verify email',
  description: 'Verify your Auvora account email.',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage(): ReactElement {
  return <VerifyEmailExperience />;
}
