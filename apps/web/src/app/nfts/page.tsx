import { redirect } from 'next/navigation';

/** NFT product line permanently removed — preserve old bookmarks. */
export default function NftsRemovedRedirect(): never {
  redirect('/dashboard');
}
