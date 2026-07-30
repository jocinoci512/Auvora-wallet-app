'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const VERSION = '0.1.0';
const BUILD = 'web-preview';

export function AboutSettingsExperience(): ReactElement {
  return (
    <PlatformShell
      title="About"
      subtitle="Version, legal, and acknowledgements."
      reassure="Preview builds are labeled honestly — not production store metadata."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/about" />}
    >
      <section className="cx-panel">
        <h2>Auvora Wallet</h2>
        <p className="cx-meta">
          Version {VERSION} · Build {BUILD}
        </p>
        <ul className="cx-list">
          <li>
            <strong>Release notes</strong>
            <p className="cx-meta">
              Sprint 8 adds Settings organization, price alerts, networks, and about — aligned with
              mobile.
            </p>
          </li>
          <li>
            <Link href="/legal" className="cx-link">
              Privacy policy &amp; terms
            </Link>
          </li>
          <li>
            <Link href="/trust" className="cx-link">
              Trust &amp; transparency
            </Link>
          </li>
          <li>
            <p className="cx-meta">
              Open-source acknowledgements ship with the store build. Web preview uses Next.js,
              React, and Auvora design packages.
            </p>
          </li>
        </ul>
      </section>
    </PlatformShell>
  );
}
