import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DRIVER_SESSION_COOKIE_NAME,
  DRIVER_SESSION_FORWARD_HEADER,
  DRIVER_SESSION_MAX_AGE_SEC,
  DRIVER_SESSION_PUBLIC_COOKIE_NAME,
  shouldMirrorSessionToPublicCookie,
} from '@/lib/session-constants';

/**
 * Copies session JWT onto x-shifty-session for handlers; mirrors HttpOnly → readable echo on Vercel
 * so admin fetch can send Authorization: Bearer without another login.
 */
export function middleware(request: NextRequest) {
  const httpOnly = request.cookies.get(DRIVER_SESSION_COOKIE_NAME)?.value;
  const pub = request.cookies.get(DRIVER_SESSION_PUBLIC_COOKIE_NAME)?.value;
  const token = httpOnly || pub;

  const requestHeaders = new Headers(request.headers);
  if (token) {
    requestHeaders.set(DRIVER_SESSION_FORWARD_HEADER, token);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (shouldMirrorSessionToPublicCookie() && httpOnly && (!pub || pub !== httpOnly)) {
    response.cookies.set(DRIVER_SESSION_PUBLIC_COOKIE_NAME, httpOnly, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: DRIVER_SESSION_MAX_AGE_SEC,
    });
  }

  return response;
}

export const config = {
  matcher: ['/', '/admin/:path*', '/driver/:path*', '/api/:path*', '/logout'],
};
