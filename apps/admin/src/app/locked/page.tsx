import type { ReactElement } from 'react';
import { AuthScreen } from '../../components/AdminChrome';

export default function LockedPage(): ReactElement {
  return (
    <AuthScreen
      title="Account locked"
      description="Too many failed sign-in attempts. Wait for the lockout window to expire, then try again."
    />
  );
}
