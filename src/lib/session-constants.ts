export const DRIVER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** HttpOnly cookie storing the JWT session (see auth.ts). */
export const DRIVER_SESSION_COOKIE_NAME = 'driver_session';

/**
 * Non-HttpOnly copy of the same JWT — only set when enabled (see auth.ts).
 * Lets the browser send `Authorization: Bearer` on fetch when Cookie handling breaks on Vercel.
 * Disable with SHIFTY_PUBLIC_SESSION_COOKIE=0 on Vercel if you cannot accept XSS token theft risk.
 */
export const DRIVER_SESSION_PUBLIC_COOKIE_NAME = 'driver_session_echo';

/**
 * Middleware copies the cookie value into this header so Route Handlers / RSC see the token
 * even when the raw `Cookie` header is missing or fragmented on serverless (Vercel).
 * Not intended for browsers to set manually.
 */
export const DRIVER_SESSION_FORWARD_HEADER = 'x-shifty-session';

/**
 * Readable echo cookie + Bearer header for admin fetch (see auth.ts, middleware.ts).
 * On Vercel defaults to on; set SHIFTY_PUBLIC_SESSION_COOKIE=0 to disable.
 */
export function shouldMirrorSessionToPublicCookie(): boolean {
  const v = process.env.SHIFTY_PUBLIC_SESSION_COOKIE?.trim();
  if (v === '0') return false;
  if (v === '1') return true;
  return process.env.VERCEL === '1';
}
