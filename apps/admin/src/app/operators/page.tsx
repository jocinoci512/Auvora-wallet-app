'use client';

import type { AdminOperator } from '../../lib/admin-session';
import { Alert, AsyncStates, Button, PageHeader, Pagination, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmReasonDialog } from '../../components/ConfirmReasonDialog';
import { Subnav } from '../../components/Subnav';
import {
  adminAssignOperatorRoles,
  adminListOperators,
  adminResetOperatorMfa,
  adminRevokeOperatorSessions,
  adminUpdateOperatorStatus,
} from '../../lib/admin-control-plane';
import { displayName, formatWhen } from '../../lib/admin-format';
import { useAdminIdentity } from '../../lib/admin-identity';
import { hasPermission, primaryRole, roleLabel } from '../../lib/admin-rbac';
import { formatAdminError, isStepUpRequired } from '../../lib/api-client';
import { IDENTITY_LINKS } from '../../lib/section-nav';

const PAGE_SIZE = 25;
const PORTAL_ROLES = ['super_admin', 'admin', 'security_analyst', 'support', 'read_only'];

type OperatorAction =
  | { type: 'roles'; operator: AdminOperator; roles: string[] }
  | { type: 'status'; operator: AdminOperator; status: 'SUSPENDED' | 'ACTIVE' }
  | { type: 'sessions'; operator: AdminOperator }
  | { type: 'mfa'; operator: AdminOperator };

export default function AdminOperatorsPage(): ReactElement {
  const router = useRouter();
  const identity = useAdminIdentity();
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState({ query: '', page: 1 });
  const [pending, setPending] = useState<OperatorAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = hasPermission(identity?.operator, 'admins:manage');
  const canRoles = hasPermission(identity?.operator, 'roles:manage');
  const canRevoke = hasPermission(identity?.operator, 'sessions:revoke');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminListOperators({
        query: applied.query.trim() || undefined,
        skip: (applied.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setOperators(result.operators);
      setTotal(result.total);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm(reason: string): Promise<void> {
    if (!pending) return;
    setBusy(true);
    setNotice(null);
    try {
      if (pending.type === 'roles') {
        await adminAssignOperatorRoles(pending.operator.id, pending.roles, reason);
        setNotice('Administrator roles updated');
      } else if (pending.type === 'status') {
        await adminUpdateOperatorStatus(pending.operator.id, pending.status, reason);
        setNotice(`Administrator ${pending.status.toLowerCase()}`);
      } else if (pending.type === 'sessions') {
        const result = await adminRevokeOperatorSessions(pending.operator.id, reason);
        setNotice(`${result.revoked} session${result.revoked === 1 ? '' : 's'} revoked`);
      } else {
        await adminResetOperatorMfa(pending.operator.id, reason);
        setNotice('MFA reset. The administrator must enroll again.');
      }
      setPending(null);
      await load();
    } catch (err) {
      if (isStepUpRequired(err)) {
        router.push('/step-up?next=/operators');
        return;
      }
      setError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Admin management"
        subtitle={`${total} administrator account${total === 1 ? '' : 's'}`}
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      {notice ? (
        <Alert tone="success" title="Updated">
          {notice}
        </Alert>
      ) : null}

      <section className="panel filters" aria-label="Administrator filters">
        <form
          className="filters__row"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({ query, page: 1 });
          }}
        >
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="field-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Email or username"
            />
          </label>
          <Button type="submit">Search</Button>
        </form>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading administrators…"
        error={error}
        errorTitle="Could not load administrators"
        onRetry={() => void load()}
        empty={!loading && !error && operators.length === 0}
        emptyTitle="No administrators match"
        emptyDescription="Try another email or username."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Administrator accounts</caption>
            <thead>
              <tr>
                <th scope="col">Admin</th>
                <th scope="col">Role</th>
                <th scope="col">MFA</th>
                <th scope="col">Status</th>
                <th scope="col">Last login</th>
                <th scope="col">Sessions</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((operator) => (
                <tr key={operator.id}>
                  <td>
                    <strong>{displayName(operator)}</strong>
                    <div className="page-subtitle">{operator.email}</div>
                  </td>
                  <td>{roleLabel(primaryRole(operator))}</td>
                  <td>{operator.mfaEnrolled ? 'Enrolled' : 'Not enrolled'}</td>
                  <td>
                    <StatusBadge status={operator.status} />
                  </td>
                  <td>{formatWhen(operator.lastLoginAt)}</td>
                  <td>{operator.activeSessionCount}</td>
                  <td>
                    <div className="action-row">
                      {canRoles ? (
                        <RolePicker
                          operator={operator}
                          onSave={(roles) => setPending({ type: 'roles', operator, roles })}
                        />
                      ) : null}
                      {canManage && operator.status !== 'SUSPENDED' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setPending({ type: 'status', operator, status: 'SUSPENDED' })
                          }
                        >
                          Suspend
                        </Button>
                      ) : null}
                      {canManage && operator.status === 'SUSPENDED' ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setPending({ type: 'status', operator, status: 'ACTIVE' })}
                        >
                          Reactivate
                        </Button>
                      ) : null}
                      {canRevoke ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPending({ type: 'sessions', operator })}
                        >
                          Revoke sessions
                        </Button>
                      ) : null}
                      {canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPending({ type: 'mfa', operator })}
                        >
                          Reset MFA
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={applied.page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={(next) => {
            setApplied((current) => ({ ...current, page: next }));
          }}
        />
      </AsyncStates>

      <ConfirmReasonDialog
        open={pending !== null}
        title="Confirm administrator action"
        description="High-risk administrator changes require a reason and a recent step-up confirmation."
        pending={busy}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={confirm}
      />
    </div>
  );
}

function RolePicker({
  operator,
  onSave,
}: {
  operator: AdminOperator;
  onSave: (roles: string[]) => void;
}): ReactElement {
  const [roles, setRoles] = useState(operator.roles);
  return (
    <label className="field">
      <span className="auvora-sr-only">Change role for {operator.email}</span>
      <select
        className="field-input"
        value={primaryRole({ ...operator, roles })}
        onChange={(event) => {
          const next = [event.target.value];
          setRoles(next);
          onSave(next);
        }}
      >
        {PORTAL_ROLES.map((role) => (
          <option key={role} value={role}>
            {roleLabel(role)}
          </option>
        ))}
      </select>
    </label>
  );
}
