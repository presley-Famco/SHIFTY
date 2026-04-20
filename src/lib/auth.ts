import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { applyTrustedAdminBypass, findUserById, type User } from './db';

function authSecretBytes(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    'dev-only-secret-change-me-in-prod-please-xxxxxxxxxxxxxxxx';
  return new TextEncoder().encode(raw);
}
const COOKIE_NAME = 'driver_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    let val = part.slice(idx + 1).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  }
  return null;
}

async function userFromSessionToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, authSecretBytes());
    const userId = payload.sub;
    if (typeof userId !== 'string') return null;
    const raw = await findUserById(userId);
    if (!raw) return null;
    const user = applyTrustedAdminBypass(raw);
    // Trusted owner always passes the driver gate after bypass (role becomes admin).
    if (user.role === 'driver' && user.driver_status !== 'active_compliant') return null;
    return user;
  } catch {
    return null;
  }
}

/** Use in Route Handlers when `cookies()` from next/headers does not see the session cookie. */
export async function getCurrentUserFromRequest(req: Request): Promise<User | null> {
  const token = getCookieFromHeader(req.headers.get('cookie'), COOKIE_NAME);
  if (!token) return null;
  return userFromSessionToken(token);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(authSecretBytes());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  let token = cookies().get(COOKIE_NAME)?.value ?? null;
  // Server Actions on Vercel sometimes don't populate `cookies()`; fall back to raw header (same source as browsers send).
  if (!token) {
    token = getCookieFromHeader(headers().get('cookie'), COOKIE_NAME);
  }
  if (!token) return null;
  return userFromSessionToken(token);
}
