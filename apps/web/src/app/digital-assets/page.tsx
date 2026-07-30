import { redirect } from 'next/navigation';

/** Digital assets hub removed with NFT product line. */
export default function DigitalAssetsRemovedRedirect(): never {
  redirect('/dashboard');
}
