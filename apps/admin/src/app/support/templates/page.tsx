'use client';

import { Alert, PageHeader } from '@auvora/ui';
import type { ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { DEMO_TEMPLATES } from '../../../lib/support-demo';
import { SUPPORT_LINKS } from '../../../lib/section-nav';

export default function SupportTemplatesPage(): ReactElement {
  return (
    <main className="page">
      <PageHeader
        title="Response templates"
        subtitle="Reusable agent replies with clear security and fee language."
      >
        <Subnav label="Support" links={SUPPORT_LINKS} />
      </PageHeader>

      <Alert tone="warn" title="Preview templates">
        Templates are local demo content until a support CMS exists.
      </Alert>

      <ul className="stack" style={{ marginTop: '1rem' }}>
        {DEMO_TEMPLATES.map((tpl) => (
          <li key={tpl.id}>
            <strong>{tpl.name}</strong>
            <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
              {tpl.category}
            </p>
            <p style={{ marginTop: '0.5rem' }}>{tpl.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
