'use client';

import { Alert, Button, PageHeader } from '@auvora/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { isProductionBuild } from '../../lib/api-client';
import { IDENTITY_LINKS } from '../../lib/section-nav';

type SettingItem = {
  title: string;
  description: string;
  href?: string;
  cta?: string;
  available: boolean;
};

export default function SystemSettingsPage(): ReactElement {
  const production = isProductionBuild();
  const items: SettingItem[] = [
    {
      title: 'Feature flags',
      description: 'Toggle environment-scoped product behavior without redeploy.',
      href: '/infrastructure/config',
      cta: 'Open flags',
      available: !production,
    },
    {
      title: 'Maintenance mode',
      description: 'Publish notices for the public status page and ops overview.',
      href: '/observability/maintenance',
      cta: 'Open maintenance',
      available: !production,
    },
    {
      title: 'Cluster & deployments',
      description: 'Environments, deployments, backups, and recovery drills.',
      href: '/infrastructure',
      cta: 'Open infrastructure',
      available: !production,
    },
    {
      title: 'Content management',
      description:
        'Marketing and education CMS remains outside this control plane. Runtime secrets stay in the secret manager.',
      available: false,
    },
  ];

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
        {items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <p className="page-subtitle">{item.description}</p>
            {item.available && item.href && item.cta ? (
              <Link href={item.href}>
                <Button variant="secondary">{item.cta}</Button>
              </Link>
            ) : (
              <p className="page-subtitle" role="status">
                Not available in this environment
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
