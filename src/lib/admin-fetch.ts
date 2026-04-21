'use client';

import { DRIVER_SESSION_PUBLIC_COOKIE_NAME } from '@/lib/session-constants';

/** Authorization header from readable echo cookie (server sets when public session enabled). */
function bearerFromEchoCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${DRIVER_SESSION_PUBLIC_COOKIE_NAME}=`;
  const row = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  if (!row) return undefined;
  let val = row.slice(prefix.length);
  try {
    val = decodeURIComponent(val);
  } catch {
    /* keep raw */
  }
  return val || undefined;
}

/** Merge into every same-origin `/api/admin/*` fetch so auth works when Cookie headers are unreliable. */
export function adminFetchInit(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  const bearer = bearerFromEchoCookie();
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  return {
    ...init,
    credentials: 'include',
    headers,
  };
}
