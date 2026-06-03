import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('collab_notes_token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isProtectedPage = pathname === '/dashboard' || pathname.startsWith('/workspace');

  if (!token && isProtectedPage) {
    // User is not logged in and wants to access protected page -> redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthPage) {
    // User is logged in and wants to access login/register -> redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard',
    '/workspace/:path*',
    '/login',
    '/register',
  ],
};
