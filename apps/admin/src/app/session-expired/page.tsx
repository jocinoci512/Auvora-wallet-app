import type { ReactElement } from 'react';
import { AuthScreen } from '../../components/AdminChrome';

export default function SessionExpiredPage(): ReactElement {
  return (
    <AuthScreen
      title="Session expired"
      description="Your administrator session ended. Sign in again to continue."
    >
      <p className="admin-auth-copy">Revoked and expired sessions cannot reconnect to realtime.</p>
    </AuthScreen>
  );
}
