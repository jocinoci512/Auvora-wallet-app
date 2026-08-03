import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthExperience } from '../../../components/auth/AuthExperience';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Auvora account — identity sync without private keys.',
  robots: { index: false, follow: false },
};

export default function LoginPage(): ReactElement {
  return <AuthExperience mode="login" />;
}
