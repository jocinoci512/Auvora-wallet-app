import type { ReactElement } from 'react';
import { AuthScreen } from '../../components/AdminChrome';

export default function SuspendedPage(): ReactElement {
  return (
    <AuthScreen
      title="Administrator suspended"
      description="This administrator account cannot sign in. Contact a super administrator."
    />
  );
}
