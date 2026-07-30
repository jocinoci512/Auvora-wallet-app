'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../../components/legal/LegalShell';

export default function PrivacyPolicyPage(): ReactElement {
  return (
    <LegalShell
      title="Privacy"
      subtitle="What stays on your device, what may be shared, and what you control."
      current="/legal/privacy"
    >
      <section className="cx-panel">
        <h2>Principles</h2>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Self-custody first</strong>
              <p className="cx-meta">
                Recovery phrases and private keys are never collected by Auvora Assistant or support
                chat. We will never ask for them.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Local preferences</strong>
              <p className="cx-meta">
                Theme, privacy toggles, notification categories, and assistant history (when
                enabled) can stay on this device.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Optional analytics</strong>
              <p className="cx-meta">
                Analytics and non-essential cookies are off unless you turn them on in Privacy
                Center.
              </p>
            </div>
          </li>
        </ul>
      </section>
      <section className="cx-panel">
        <h2>Your controls</h2>
        <p>
          Manage analytics, crash reporting, personalization, and Assistant settings in{' '}
          <Link href="/settings/privacy">Privacy Center</Link>.
        </p>
      </section>
      <section className="cx-panel">
        <h2>Before public GA</h2>
        <p className="cx-meta">
          A counsel-approved Privacy Policy URL will replace this draft. Regional disclosures (e.g.
          GDPR / CCPA) will be published with the production site.
        </p>
      </section>
    </LegalShell>
  );
}
