import type { ReactElement } from 'react';
import { AuthScreen } from '../../components/AdminChrome';

export default function ForbiddenPage(): ReactElement {
  return (
    <AuthScreen
      title="Access denied"
      description="This control plane is restricted to the owner Super Admin. Other administrator roles cannot enter."
    />
  );
}
