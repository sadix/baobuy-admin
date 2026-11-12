// middleware.ts — Edge-safe gate (JWT check only; no Prisma here).
// NOTE: Next 16 renamed this convention to `proxy.ts` (export `proxy`); `middleware.ts` still works but is deprecated.
// This is only the FIRST layer: the layout and every route handler re-verify via getAdmin().
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const email = token ? await verifySessionToken(token) : null;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!email && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (email && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
