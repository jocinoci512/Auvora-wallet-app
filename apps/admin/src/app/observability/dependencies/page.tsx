'use client';

import { AuvoraClientError, type OpsDependencyGraph } from '@auvora/sdk';
import { AsyncStates, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

export default function AdminDependenciesPage(): ReactElement {
  const [data, setData] = useState<OpsDependencyGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setData(await client.adminObservabilityDependencies());
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nodes = data?.nodes ?? [];
  const edges = Array.isArray(data?.edges) ? data.edges : [];

  return (
    <main className="page">
      <PageHeader
        title="Dependencies"
        subtitle="Service dependency graph for incident blast-radius."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading dependencies…"
        error={error}
        errorTitle="Could not load dependencies"
        onRetry={() => void load()}
        empty={!loading && !error && nodes.length === 0}
        emptyTitle="No dependency map"
        emptyDescription="Publish service dependencies via observability APIs."
      >
        <section className="panel" aria-label="Services">
          <h2>Services ({nodes.length})</h2>
          <ul className="stack">
            {nodes.map((node) => (
              <li key={node.id}>
                <code>{node.id}</code>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" style={{ marginTop: '1rem' }} aria-label="Edges">
          <h2>Edges ({edges.length})</h2>
          <ul className="stack">
            {edges.map((edge, index) => {
              const row = edge as {
                sourceService?: string;
                targetService?: string;
                dependencyType?: string;
              };
              return (
                <li key={`${row.sourceService}-${row.targetService}-${index}`}>
                  <code>{row.sourceService ?? '?'}</code> → <code>{row.targetService ?? '?'}</code>
                  {row.dependencyType ? ` (${row.dependencyType})` : ''}
                </li>
              );
            })}
            {edges.length === 0 ? <li>No edges recorded.</li> : null}
          </ul>
        </section>
      </AsyncStates>
    </main>
  );
}
