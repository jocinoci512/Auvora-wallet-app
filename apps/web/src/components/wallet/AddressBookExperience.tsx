'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@auvora/ui';
import { Pencil, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type ReactElement } from 'react';
import {
  deleteContact,
  listContacts,
  upsertContact,
} from '../../lib/wallet-experience/address-book';
import {
  NETWORKS,
  type AddressContact,
  type WalletNetwork,
} from '../../lib/wallet-experience/types';
import { validateAddressFormat } from '../../lib/wallet-experience/validation';
import { CxActions, humanizeError, TransactionShell } from '../transaction/TransactionShell';
import '../../app/core-experience.css';

function slugId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}

export function AddressBookExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [items, setItems] = useState<AddressContact[]>(() => listContacts());
  const [editing, setEditing] = useState<AddressContact | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    network: 'ethereum' as WalletNetwork,
    group: 'Personal',
    note: '',
    favorite: false,
  });
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const set = new Set(items.map((c) => c.group || 'Ungrouped'));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (groupFilter !== 'all' && (c.group || 'Ungrouped') !== groupFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, query, groupFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AddressContact[]>();
    for (const c of filtered) {
      const g = c.group || 'Ungrouped';
      const bucket = map.get(g) ?? [];
      bucket.push(c);
      map.set(g, bucket);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function refresh(): void {
    setItems(listContacts());
  }

  function openCreate(): void {
    setEditing(null);
    setForm({
      name: '',
      address: '',
      network: 'ethereum',
      group: 'Personal',
      note: '',
      favorite: false,
    });
    setError(null);
    setOpen(true);
  }

  function openEdit(c: AddressContact): void {
    setEditing(c);
    setForm({
      name: c.name,
      address: c.address,
      network: c.network,
      group: c.group || 'Personal',
      note: c.note || '',
      favorite: c.favorite,
    });
    setError(null);
    setOpen(true);
  }

  function save(): void {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const v = validateAddressFormat(form.address, form.network);
    if (!v.ok) {
      setError(humanizeError(v.message, 'That address does not look right for this network.'));
      return;
    }
    const address = form.address.trim();
    const duplicate = items.find(
      (c) =>
        c.id !== editing?.id &&
        c.network === form.network &&
        c.address.toLowerCase() === address.toLowerCase(),
    );
    if (
      duplicate &&
      !window.confirm(`Already saved as “${duplicate.name}”. Save another contact anyway?`)
    ) {
      return;
    }
    upsertContact({
      id: editing?.id,
      name: form.name.trim(),
      address,
      network: form.network,
      group: form.group.trim() || 'Personal',
      note: form.note.trim() || undefined,
      favorite: form.favorite,
    });
    setOpen(false);
    refresh();
  }

  function remove(id: string): void {
    if (!window.confirm('Delete this contact?')) return;
    deleteContact(id);
    refresh();
  }

  function toggleFavorite(c: AddressContact): void {
    upsertContact({ ...c, favorite: !c.favorite });
    refresh();
  }

  return (
    <TransactionShell
      title="Address book"
      subtitle="Favorites, groups, search, and quick picks for Send."
      reassure="Contacts stay on this device for the preview experience."
      backHref="/wallets"
      backLabel="Wallets"
    >
      <div className="cx-wide">
        <section className="cx-panel">
          <div className="cx-field-row">
            <label className="cx-field cx-field--grow">
              <span>Search contacts</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, address, note…"
              />
            </label>
            <label className="cx-field">
              <span>Group</span>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g === 'all' ? 'All groups' : g}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="cx-btn cx-btn--primary" onClick={openCreate}>
              Add contact
            </button>
          </div>
        </section>

        {!filtered.length ? (
          <section className="cx-panel">
            <h2>No contacts</h2>
            <p className="cx-meta">Add people and wallets you trust for faster, safer sends.</p>
            <CxActions onNext={openCreate} nextLabel="Add contact" />
          </section>
        ) : (
          grouped.map(([group, rows]) => {
            const groupId = `g-${slugId(group)}`;
            return (
              <section key={group} className="cx-panel" aria-labelledby={groupId}>
                <h2 id={groupId}>{group}</h2>
                <ul className="cx-list">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <div>
                        <strong>
                          {c.favorite ? '★ ' : ''}
                          {c.name}
                        </strong>
                        <p className="cx-meta">
                          {c.network} · <code>{c.address}</code>
                        </p>
                        {c.note ? <p className="cx-meta">{c.note}</p> : null}
                      </div>
                      <div className="cx-chips">
                        <button
                          type="button"
                          className={`cx-chip ${c.favorite ? 'is-on' : ''}`}
                          aria-label={c.favorite ? 'Unfavorite' : 'Favorite'}
                          onClick={() => toggleFavorite(c)}
                        >
                          <Star size={14} fill={c.favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className="cx-chip"
                          aria-label="Edit"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="cx-chip"
                          aria-label="Delete"
                          onClick={() => remove(c.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                        <Link
                          href={`/send?to=${encodeURIComponent(c.address)}&asset=${encodeURIComponent(
                            NETWORKS.find((n) => n.id === c.network)?.asset ?? 'ETH',
                          )}`}
                          className="cx-chip"
                        >
                          Send
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>{editing ? 'Edit contact' : 'Add contact'}</DialogTitle>
            <DialogDescription>
              Stored locally on this device for the preview experience.
            </DialogDescription>
            <div className="cx-panel" style={{ boxShadow: 'none', padding: 0 }}>
              <label className="cx-field">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
              <label className="cx-field">
                <span>Network</span>
                <select
                  value={form.network}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, network: e.target.value as WalletNetwork }))
                  }
                >
                  {NETWORKS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cx-field">
                <span>Address</span>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="0x… / name.eth / domain.crypto"
                  spellCheck={false}
                />
              </label>
              <label className="cx-field">
                <span>Group</span>
                <input
                  value={form.group}
                  onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                />
              </label>
              <label className="cx-field">
                <span>Note</span>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
              <label
                className="cx-field"
                style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}
              >
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(e) => setForm((f) => ({ ...f, favorite: e.target.checked }))}
                />
                <span>Favorite</span>
              </label>
              {error ? (
                <div className="cx-alert cx-alert--error">
                  <strong>Cannot save</strong>
                  <p>{error}</p>
                </div>
              ) : null}
              <CxActions
                onNext={save}
                nextLabel="Save"
                onBack={() => setOpen(false)}
                backLabel="Cancel"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TransactionShell>
  );
}
