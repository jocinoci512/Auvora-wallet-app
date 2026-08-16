import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { AuthStatusExperience } from '../../../components/auth/AuthStatusExperience';

export const metadata: Metadata = {
  title: 'Temporarily limited',
  robots: { index: false, follow: false },
};

export default function RateLimitedPage(): ReactElement {
  return <AuthStatusExperience status="rate_limited" />;
}
