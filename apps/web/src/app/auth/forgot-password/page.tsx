import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { ForgotPasswordExperience } from '../../../components/auth/ForgotPasswordExperience';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Reset your Auvora account password.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage(): ReactElement {
  return <ForgotPasswordExperience />;
}
