import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthExperience } from '../../../components/auth/AuthExperience';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create an Auvora account for preferences and device sessions — never seed phrases.',
  robots: { index: false, follow: false },
};

export default function RegisterPage(): ReactElement {
  return <AuthExperience mode="register" />;
}
