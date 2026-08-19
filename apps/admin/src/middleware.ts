import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/mfa',
  '/mfa/enroll',
  '/recovery',
  '/locked',
  '/forbidden',
  '/session-expired',
  '/suspended',
  '/step-up',
];

const DEFERRED_MESH_PREFIXES = [
  '/payments',
  '/compliance',
  '/custody',
  '/notifications',
  '/analytics',
  '/infrastructure',
  '/ai',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isDeferredMeshPath(pathname: string): boolean {
  if (pathname === '/observability' || pathname.startsWith('/observability/')) {
    return !pathname.startsWith('/observability/health');
  }
  return DEFERRED_MESH_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname === '/favicon.ico' ||
    isPublic(pathname)
  ) {
    return NextResponse.next();
  }
  if (process.env.VERCEL_ENV === 'production' && isDeferredMeshPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/unavailable';
    url.searchParams.set('feature', pathname);
    return NextResponse.redirect(url);
  }
  // UX-only marker cookie on the Admin origin. Production credentials are HttpOnly
  // cookies on the API host; the backend remains authoritative.
  if (!request.cookies.get('auvora_admin_ui')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
