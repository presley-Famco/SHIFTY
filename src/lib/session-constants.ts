/** HttpOnly cookie storing the JWT session (see auth.ts). */
export const DRIVER_SESSION_COOKIE_NAME = 'driver_session';

/**
 * Middleware copies the cookie value into this header so Route Handlers / RSC see the token
 * even when the raw `Cookie` header is missing or fragmented on serverless (Vercel).
 * Not intended for browsers to set manually.
 */
export const DRIVER_SESSION_FORWARD_HEADER = 'x-shifty-session';
