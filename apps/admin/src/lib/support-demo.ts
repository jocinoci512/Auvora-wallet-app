/**
 * Support platform preview data.
 * There is no ticket domain API yet — surfaces are labeled demo until wired.
 */

export type SupportTicketStatus = 'open' | 'pending' | 'escalated' | 'resolved';
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  subject: string;
  requesterEmail: string;
  userId: string | null;
  status: SupportTicketStatus;
  priority: SupportPriority;
  channel: 'email' | 'in_app' | 'chat';
  assignee: string | null;
  csat: number | null;
  updatedAt: string;
  createdAt: string;
  verifiedUser: boolean;
}

export interface SupportNote {
  id: string;
  ticketId: string;
  author: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface SupportKbArticle {
  id: string;
  title: string;
  category: string;
  updatedAt: string;
  published: boolean;
}

export interface SupportTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
}

export const DEMO_TICKETS: SupportTicket[] = [
  {
    id: 'tkt_8f2a',
    subject: 'Cannot complete send — network fee unclear',
    requesterEmail: 'alex@example.com',
    userId: 'usr_demo_1',
    status: 'open',
    priority: 'high',
    channel: 'in_app',
    assignee: 'Jordan Lee',
    csat: null,
    updatedAt: '2026-07-29T18:12:00.000Z',
    createdAt: '2026-07-29T16:40:00.000Z',
    verifiedUser: true,
  },
  {
    id: 'tkt_3c91',
    subject: 'Recovery phrase backup confirmation',
    requesterEmail: 'sam@example.com',
    userId: 'usr_demo_2',
    status: 'pending',
    priority: 'normal',
    channel: 'email',
    assignee: null,
    csat: null,
    updatedAt: '2026-07-28T21:05:00.000Z',
    createdAt: '2026-07-28T20:11:00.000Z',
    verifiedUser: true,
  },
  {
    id: 'tkt_a104',
    subject: 'Suspicious login notification — need review',
    requesterEmail: 'morgan@example.com',
    userId: null,
    status: 'escalated',
    priority: 'urgent',
    channel: 'chat',
    assignee: 'Security L2',
    csat: null,
    updatedAt: '2026-07-29T14:22:00.000Z',
    createdAt: '2026-07-29T13:58:00.000Z',
    verifiedUser: false,
  },
  {
    id: 'tkt_55be',
    subject: 'Education hub lesson feedback',
    requesterEmail: 'rio@example.com',
    userId: 'usr_demo_4',
    status: 'resolved',
    priority: 'low',
    channel: 'email',
    assignee: 'Casey Ng',
    csat: 5,
    updatedAt: '2026-07-27T11:30:00.000Z',
    createdAt: '2026-07-26T09:15:00.000Z',
    verifiedUser: true,
  },
];

export const DEMO_NOTES: SupportNote[] = [
  {
    id: 'note_1',
    ticketId: 'tkt_8f2a',
    author: 'Jordan Lee',
    body: 'Asked for network + asset; linked fee explainer from KB.',
    internal: true,
    createdAt: '2026-07-29T17:02:00.000Z',
  },
  {
    id: 'note_2',
    ticketId: 'tkt_8f2a',
    author: 'Jordan Lee',
    body: 'Thanks for waiting — can you confirm whether you are on Ethereum or Solana?',
    internal: false,
    createdAt: '2026-07-29T17:05:00.000Z',
  },
  {
    id: 'note_3',
    ticketId: 'tkt_a104',
    author: 'Security L2',
    body: 'Escalated from L1. Recommend force-logout + session review once user verifies.',
    internal: true,
    createdAt: '2026-07-29T14:20:00.000Z',
  },
];

export const DEMO_KB: SupportKbArticle[] = [
  {
    id: 'kb_fees',
    title: 'Understanding network fees',
    category: 'Transactions',
    updatedAt: '2026-07-20T00:00:00.000Z',
    published: true,
  },
  {
    id: 'kb_backup',
    title: 'Backup and recovery checklist',
    category: 'Security',
    updatedAt: '2026-07-18T00:00:00.000Z',
    published: true,
  },
  {
    id: 'kb_devices',
    title: 'Trusted devices and sessions',
    category: 'Security',
    updatedAt: '2026-07-12T00:00:00.000Z',
    published: true,
  },
  {
    id: 'kb_draft',
    title: 'Draft — staking rewards FAQ',
    category: 'Earn',
    updatedAt: '2026-07-28T00:00:00.000Z',
    published: false,
  },
];

export const DEMO_TEMPLATES: SupportTemplate[] = [
  {
    id: 'tpl_verify',
    name: 'Identity verification request',
    category: 'Security',
    body: 'To protect your account, please confirm the device and approximate time of the login shown in your notification center.',
  },
  {
    id: 'tpl_fee',
    name: 'Network fee explainer',
    category: 'Transactions',
    body: 'Network fees are paid to the blockchain, not Auvora. The amount varies by congestion; you can review the estimate before confirming.',
  },
  {
    id: 'tpl_csat',
    name: 'CSAT follow-up',
    category: 'Quality',
    body: 'Was this helpful? A one-tap rating helps us improve support quality.',
  },
];

export function getDemoTicket(id: string): SupportTicket | undefined {
  return DEMO_TICKETS.find((t) => t.id === id);
}

export function getDemoNotes(ticketId: string): SupportNote[] {
  return DEMO_NOTES.filter((n) => n.ticketId === ticketId);
}
