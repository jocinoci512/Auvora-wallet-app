import { redirect } from 'next/navigation';

export default function NftActivityRemoved(): never {
  redirect('/dashboard');
}
