'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { ReleaseConfig } from '../../lib/release/config';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

export function AboutSettingsExperience(): ReactElement {
  return (
    <PlatformShell
      title="About"
      subtitle="Product identity and legal links — nothing extra."
      reassure="Alpha is labeled as Alpha. Funding addresses stay locked on this companion."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/about" />}
    >
      <section className="cx-panel">
        <h2>Auvora Wallet</h2>
        <p className="cx-meta">
          {ReleaseConfig.buildLabel}
          <br />
          Version {ReleaseConfig.marketingVersion} · Channel {ReleaseConfig.releaseChannel}
        </p>
        <div className="cx-alert cx-alert--warn" role="status">
          {ReleaseConfig.fundingBlockedMessage}
        </div>
        <ul className="cx-list">
          <li>
            <a
              className="cx-link"
              href={ReleaseConfig.privacyPolicyUrl}
              rel="noreferrer"
              target="_blank"
            >
              Privacy
            </a>
          </li>
          <li>
            <a
              className="cx-link"
              href={ReleaseConfig.termsOfServiceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Terms
            </a>
          </li>
          <li>
            <Link href="/legal" className="cx-link">
              Legal
            </Link>
          </li>
          <li>
            <a className="cx-link" href={`mailto:${ReleaseConfig.supportEmail}`}>
              {ReleaseConfig.supportEmail}
            </a>
          </li>
          <li>
            <a className="cx-link" href={ReleaseConfig.websiteUrl} rel="noreferrer" target="_blank">
              Website
            </a>
          </li>
        </ul>
      </section>
    </PlatformShell>
  );
}
