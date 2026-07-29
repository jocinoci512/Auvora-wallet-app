'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  IconButton,
} from '@auvora/ui';
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
import '../../app/wallet-experience.css';

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
      setError(v.message ?? 'Invalid address');
      return;
    }
    upsertContact({
      id: editing?.id,
      name: form.name.trim(),
      address: form.address.trim(),
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
    <div className="wx" role="main">
      <header className="wx__header">
        <div>
          <p className="wx__eyebrow">
            <Link href="/wallets">Wallets</Link>
          </p>
          <h1>Address book</h1>
          <p className="wx__sub">Favorites, groups, search, and quick picks for Send.</p>
        </div>
        <Button type="button" onClick={openCreate}>
          Add contact
        </Button>
      </header>

      <div className="wx-toolbar" role="search">
        <label className="wx-field wx-field--grow">
          <span className="wx-sr-only">Search contacts</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, address, note…"
          />
        </label>
        <label className="wx-field">
          <span className="wx-sr-only">Group</span>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g === 'all' ? 'All groups' : g}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!filtered.length ? (
        <EmptyState
          title="No contacts"
          description="Add people and wallets you trust for faster, safer sends."
          action={
            <Button type="button" onClick={openCreate}>
              Add contact
            </Button>
          }
        />
      ) : (
        grouped.map(([group, rows]) => {
          const groupId = `g-${slugId(group)}`;
          return (
            <section key={group} className="wx-panel" aria-labelledby={groupId}>
              <h2 id={groupId}>{group}</h2>
              <ul className="wx-contact-list">
                {rows.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>
                        {c.favorite ? '★ ' : ''}
                        {c.name}
                      </strong>
                      <p className="wx-meta">
                        {c.network} · <code>{c.address}</code>
                      </p>
                      {c.note ? <p className="wx-meta">{c.note}</p> : null}
                    </div>
                    <div className="wx-contact-actions">
                      <IconButton
                        label={c.favorite ? 'Unfavorite' : 'Favorite'}
                        onClick={() => toggleFavorite(c)}
                      >
                        <Star size={16} fill={c.favorite ? 'currentColor' : 'none'} />
                      </IconButton>
                      <IconButton label="Edit" onClick={() => openEdit(c)}>
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton label="Delete" onClick={() => remove(c.id)}>
                        <Trash2 size={16} />
                      </IconButton>
                      <Link href={`/send`}>
                        <Button size="sm" variant="secondary">
                          Send
                        </Button>
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
          <div className="wx-form-stack">
            <label className="wx-field">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="wx-field">
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
            <label className="wx-field">
              <span>Address</span>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                spellCheck={false}
              />
            </label>
            <label className="wx-field">
              <span>Group</span>
              <input
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
              />
            </label>
            <label className="wx-field">
              <span>Note</span>
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>
            <label className="wx-inline-check">
              <input
                type="checkbox"
                checked={form.favorite}
                onChange={(e) => setForm((f) => ({ ...f, favorite: e.target.checked }))}
              />
              Favorite
            </label>
            {error ? (
              <Alert tone="error" title="Cannot save">
                {error}
              </Alert>
            ) : null}
            <Button type="button" onClick={save}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
