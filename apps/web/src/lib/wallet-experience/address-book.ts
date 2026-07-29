import type { AddressContact, WalletNetwork } from './types';

const KEY = 'auvora_address_book_v1';

function read(): AddressContact[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedDefaults();
    const parsed = JSON.parse(raw) as AddressContact[];
    return Array.isArray(parsed) ? parsed : seedDefaults();
  } catch {
    return seedDefaults();
  }
}

function write(items: AddressContact[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function seedDefaults(): AddressContact[] {
  const now = new Date().toISOString();
  const items: AddressContact[] = [
    {
      id: 'c-vault',
      name: 'Cold vault',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      network: 'bitcoin',
      favorite: true,
      group: 'Self',
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    },
    {
      id: 'c-alice',
      name: 'Alice Exchange',
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      network: 'ethereum',
      favorite: true,
      group: 'Exchanges',
      note: 'Withdrawals only',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'c-sol',
      name: 'Sol treasury',
      address: '7EqQdEULxWcra9C2wv2GMqW8t1iQ8W2xQqK8YqK8YqK8',
      network: 'solana',
      favorite: false,
      group: 'Self',
      createdAt: now,
      updatedAt: now,
    },
  ];
  if (typeof window !== 'undefined') write(items);
  return items;
}

export function listContacts(): AddressContact[] {
  return read().sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function upsertContact(
  input: Omit<AddressContact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): AddressContact {
  const items = read();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = items.findIndex((c) => c.id === input.id);
    if (idx >= 0) {
      const next = { ...items[idx]!, ...input, updatedAt: now } as AddressContact;
      items[idx] = next;
      write(items);
      return next;
    }
  }
  const created: AddressContact = {
    id: `c-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    address: input.address,
    network: input.network,
    note: input.note,
    favorite: input.favorite,
    group: input.group,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: input.lastUsedAt,
  };
  items.push(created);
  write(items);
  return created;
}

export function deleteContact(id: string): void {
  write(read().filter((c) => c.id !== id));
}

export function markContactUsed(id: string): void {
  const items = read();
  const idx = items.findIndex((c) => c.id === id);
  if (idx < 0) return;
  items[idx] = {
    ...items[idx]!,
    lastUsedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  write(items);
}

export function recentRecipients(limit = 5): AddressContact[] {
  return listContacts()
    .filter((c) => c.lastUsedAt)
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, limit);
}

export function findByAddress(
  address: string,
  network?: WalletNetwork,
): AddressContact | undefined {
  const q = address.trim().toLowerCase();
  return listContacts().find(
    (c) => c.address.toLowerCase() === q && (!network || c.network === network),
  );
}
