'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../components/legal/LegalShell';
import { PlatformCardLink } from '../../components/platform/PlatformShell';

export default function LegalHubPage(): ReactElement {
  return (
    <LegalShell
      title="Legal & company"
      subtitle="Privacy, terms, and transparency — written for people, not just lawyers."
      current="/legal"
    >
      <section className="cx-panel">
        <h2>Documents</h2>
        <p className="cx-meta">
          Final counsel-approved versions replace these drafts before public GA. Until then, treat
          them as the product team’s commitment to clarity.
        </p>
        <div className="cx-card-grid">
          <PlatformCardLink
            href="/legal/privacy"
            title="Privacy"
            detail="What we collect, what stays on-device, and your controls"
          />
          <PlatformCardLink
            href="/legal/terms"
            title="Terms of use"
            detail="How Auvora Wallet may be used — self-custody responsibilities"
          />
          <PlatformCardLink
            href="/trust"
            title="Trust & transparency"
            detail="Security posture, incidents, and how we communicate risk"
          />
          <PlatformCardLink
            href="/status"
            title="Status"
            detail="Live maintenance and service health"
          />
        </div>
      </section>
      <p className="cx-meta">
        Prefer product help? Visit <Link href="/settings/help">Help</Link> or{' '}
        <Link href="/learn">Learn</Link>.
      </p>
    </LegalShell>
  );
}
