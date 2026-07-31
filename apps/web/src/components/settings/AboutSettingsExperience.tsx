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
      subtitle="Version, legal, and acknowledgements."
      reassure="Alpha builds are labeled honestly — funding and live broadcast stay locked."
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
        <p className="cx-meta">
          Support:{' '}
          <a className="cx-link" href={`mailto:${ReleaseConfig.supportEmail}`}>
            {ReleaseConfig.supportEmail}
          </a>
          {' · '}
          <a className="cx-link" href={ReleaseConfig.websiteUrl} rel="noreferrer" target="_blank">
            Website
          </a>
          {' · '}
          <a
            className="cx-link"
            href={ReleaseConfig.privacyPolicyUrl}
            rel="noreferrer"
            target="_blank"
          >
            Privacy
          </a>
          {' · '}
          <a
            className="cx-link"
            href={ReleaseConfig.termsOfServiceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Terms
          </a>
        </p>
        <ul className="cx-list">
          <li>
            <strong>Release notes</strong>
            <p className="cx-meta">
              Version 1.0 Alpha packaging for trusted testing. Receive funding stays locked; live
              broadcast kill switch is off. Reliability and store-ready Android config from Prompts
              8–10.
            </p>
          </li>
          <li>
            <Link href="/settings/feedback" className="cx-link">
              Send Alpha feedback
            </Link>
            <p className="cx-meta">Bugs, UX, performance, security, accessibility</p>
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
