import { redirect } from 'next/navigation';

export default function NftCollectionRemoved(): never {
  redirect('/dashboard');
}
