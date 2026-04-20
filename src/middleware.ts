import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DRIVER_SESSION_COOKIE_NAME,
  DRIVER_SESSION_FORWARD_HEADER,
} from '@/lib/session-constants';

/**
 * Copies the HttpOnly session cookie onto an internal header so Route Handlers and RSC
 * always see the JWT on Vercel/serverless even when Cookie parsing is inconsistent.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(DRIVER_SESSION_COOKIE_NAME)?.value;
  const requestHeaders = new Headers(request.headers);
  if (token) {
    requestHeaders.set(DRIVER_SESSION_FORWARD_HEADER, token);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/', '/admin/:path*', '/driver/:path*', '/api/:path*', '/logout'],
};
