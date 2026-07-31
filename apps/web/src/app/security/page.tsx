import type { ReactElement } from 'react';
import Link from 'next/link';
import { SecurityExperience } from '../../components/wallet/SecurityExperience';

export default function SecurityPage(): ReactElement {
  return (
    <>
      <div className="cx-alert cx-alert--info" style={{ margin: '1rem auto', maxWidth: 720 }}>
        PIN & lock is part of Security Center.{' '}
        <Link href="/settings/security">Open Security Center</Link> for score, devices, sessions,
        and emergency tools.
      </div>
      <SecurityExperience />
    </>
  );
}
