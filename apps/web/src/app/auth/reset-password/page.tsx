import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { ResetPasswordExperience } from '../../../components/auth/ResetPasswordExperience';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Choose a new Auvora account password.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage(): ReactElement {
  return <ResetPasswordExperience />;
}
