import type { AdminEventInput } from '../../domain';

export const ADMIN_EVENT_PUBLISHER = Symbol('ADMIN_EVENT_PUBLISHER');

/**
 * Publishes safe admin realtime events to the canonical Redis channel.
 * Implementations MUST be fire-and-forget safe: a Redis outage must never break
 * the calling domain flow (login, register, status change, etc.).
 */
export interface AdminEventPublisherPort {
  publish(input: AdminEventInput): Promise<void>;
}
