'use client';

import { Alert, Button, PageHeader } from '@auvora/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { IDENTITY_LINKS } from '../../lib/section-nav';

export default function SystemSettingsPage(): ReactElement {
  return (
    <main className="page">
      <PageHeader
        title="System settings"
        subtitle="Operational controls preferred over a parallel settings service — flags, maintenance, and infra config."
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <Alert tone="info" title="No secrets here">
        Runtime secrets stay in environment / secret managers. This page links to existing admin
        surfaces that already enforce RBAC.
      </Alert>

      <ul className="stack" style={{ marginTop: '1.25rem' }}>
        <li>
          <strong>Feature flags</strong>
          <p className="page-subtitle">
            Toggle environment-scoped product behavior without redeploy.
          </p>
          <Link href="/infrastructure/config">
            <Button variant="secondary">Open flags</Button>
          </Link>
        </li>
        <li>
          <strong>Maintenance mode</strong>
          <p className="page-subtitle">
            Publish notices for the public status page and ops overview.
          </p>
          <Link href="/observability/maintenance">
            <Button variant="secondary">Open maintenance</Button>
          </Link>
        </li>
        <li>
          <strong>Cluster & deployments</strong>
          <p className="page-subtitle">Environments, deployments, backups, and recovery drills.</p>
          <Link href="/infrastructure">
            <Button variant="secondary">Open infrastructure</Button>
          </Link>
        </li>
        <li>
          <strong>Content management</strong>
          <p className="page-subtitle">
            Marketing and education CMS remains outside this control plane. Runtime secrets stay in
            the secret manager.
          </p>
        </li>
      </ul>
    </main>
  );
}
