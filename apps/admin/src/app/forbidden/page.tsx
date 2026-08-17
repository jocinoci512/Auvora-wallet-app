import type { ReactElement } from 'react';
import { AuthScreen } from '../../components/AdminChrome';

export default function ForbiddenPage(): ReactElement {
  return (
    <AuthScreen
      title="Access denied"
      description="This identity is not an administrator, or it does not have permission for that action."
    />
  );
}
