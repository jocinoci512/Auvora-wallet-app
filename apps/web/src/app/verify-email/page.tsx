import { redirect } from 'next/navigation';

/** Legacy mail link target → canonical auth verify route. */
export default async function VerifyEmailRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<never> {
  const params = await searchParams;
  const token = params.token ? encodeURIComponent(params.token) : '';
  redirect(token ? `/auth/verify-email?token=${token}` : '/auth/verify-email');
}
