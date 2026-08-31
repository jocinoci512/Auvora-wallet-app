/**
 * Pure activation routing for cross-device vault restore.
 * Recovery phrase is never the normal happy path.
 */
export type ActivationRoute = 'checking' | 'unlock' | 'ready' | 'missing' | 'recover';

export function resolveActivationRoute(input: {
  hasRemoteVault: boolean;
  hasLocalSessionVault: boolean;
  recoverExplicit?: boolean;
}): ActivationRoute {
  if (input.recoverExplicit) return 'recover';
  if (input.hasRemoteVault && input.hasLocalSessionVault) return 'ready';
  if (input.hasRemoteVault) return 'unlock';
  return 'missing';
}
