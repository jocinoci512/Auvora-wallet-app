import { redirect } from 'next/navigation';

/** Legacy path — premium create wizard lives at /wallets/create */
export default function LegacyNewWalletPage(): never {
  redirect('/wallets/create');
}
