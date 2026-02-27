import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only protect /app/*
  if (!pathname.startsWith('/app')) return NextResponse.next();

  // Cookie-based session (normal auth)
  const hasSession = Boolean(req.cookies.get('block_session')?.value);
  // Dev-only local login (set by web dev-auth helper)
  const hasDev = Boolean(req.cookies.get('block_dev')?.value);

  if (hasSession || hasDev) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/join';
  url.search = `?next=${encodeURIComponent(pathname + (search || ''))}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/app/:path*']
};

