import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAdmin = (req.auth?.user as any)?.role === 'admin';

  if (!isLoggedIn && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname.startsWith('/admin') && !isAdmin) {
    return NextResponse.redirect(new URL('/matches', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)'],
};
