import { redirect } from 'next/navigation';

export default function NftAssetRemoved(): never {
  redirect('/dashboard');
}
