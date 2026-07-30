'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { LegalShell } from '../../components/legal/LegalShell';

export default function TrustPage(): ReactElement {
  return (
    <LegalShell
      title="Trust & transparency"
      subtitle="How we communicate risk, security, and incidents — without fear or theater."
      current="/trust"
    >
      <section className="cx-panel">
        <h2>What you can always expect</h2>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Honest mode labels</strong>
              <p className="cx-meta">
                Preview and simulator flows say so. Success screens never claim on-chain settlement
                when nothing broadcast.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Security Center</strong>
              <p className="cx-meta">
                PIN, recovery rehearsal, devices, and permissions —{' '}
                <Link href="/settings/security">open Security</Link>.
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Public status</strong>
              <p className="cx-meta">
                Maintenance and incidents appear on <Link href="/status">Status</Link>.
              </p>
            </div>
          </li>
        </ul>
      </section>
      <section className="cx-panel">
        <h2>Education over pressure</h2>
        <p>
          Insights and Assistant explain concentration, fees, and recovery. They never shame or
          auto-trade. Continue in <Link href="/learn">Learn</Link> or{' '}
          <Link href="/assistant">Assistant</Link>.
        </p>
      </section>
      <section className="cx-panel">
        <h2>Incident communication</h2>
        <p className="cx-meta">
          During incidents we prioritize: what is affected, what is not, what you should do, and
          when we will update next. Marketing never outruns Status.
        </p>
      </section>
    </LegalShell>
  );
}
