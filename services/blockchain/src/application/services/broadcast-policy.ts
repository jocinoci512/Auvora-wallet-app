import type { ServiceEnv } from '../../config/env.schema';
import { ValidationError } from '../../domain';

/**
 * Closed Beta / production safety: live chain broadcast is OFF unless explicitly enabled.
 * Default env is BLOCKCHAIN_LIVE_BROADCAST=false.
 */
export function assertLiveBroadcastAllowed(env: ServiceEnv): void {
  if (env.BLOCKCHAIN_LIVE_BROADCAST !== true) {
    throw new ValidationError(
      'Live blockchain broadcast is disabled (BLOCKCHAIN_LIVE_BROADCAST=false). ' +
        'Pre-signed broadcast remains unavailable until this flag is intentionally enabled.',
    );
  }
}
