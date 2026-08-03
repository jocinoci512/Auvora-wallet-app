import { redirect } from 'next/navigation';

/** Merged into Security Center. */
export default function SecurityRedirectPage(): never {
  redirect('/settings/security');
}
