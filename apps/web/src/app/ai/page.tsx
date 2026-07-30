import { redirect } from 'next/navigation';

/** Legacy AI lab route — consumer Assistant lives at /assistant. */
export default function AiRedirectPage(): never {
  redirect('/assistant');
}
