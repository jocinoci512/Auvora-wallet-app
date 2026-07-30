'use client';

import { Alert, PageHeader, StatusBadge } from '@auvora/ui';
import type { ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { DEMO_KB } from '../../../lib/support-demo';
import { SUPPORT_LINKS } from '../../../lib/section-nav';

export default function SupportKbPage(): ReactElement {
  return (
    <main className="page">
      <PageHeader
        title="Knowledge base"
        subtitle="Support articles for agents — distinct from AI RAG sources under /ai/knowledge."
      >
        <Subnav label="Support" links={SUPPORT_LINKS} />
      </PageHeader>

      <Alert tone="warn" title="Content preview">
        CMS APIs are not implemented. Articles below are labeled demo content for Phase 8 IA.
      </Alert>

      <ul className="stack" style={{ marginTop: '1rem' }}>
        {DEMO_KB.map((article) => (
          <li key={article.id}>
            <StatusBadge status={article.published ? 'published' : 'draft'} />{' '}
            <strong>{article.title}</strong>
            <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
              {article.category} · updated {new Date(article.updatedAt).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
