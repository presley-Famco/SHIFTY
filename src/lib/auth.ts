import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import {
  applyTrustedAdminBypass,
  ensureTrustedAdminPlaceholder,
  findUserByEmail,
  findUserById,
  type User,
} from './db';
import {
  DRIVER_SESSION_COOKIE_NAME,
  DRIVER_SESSION_FORWARD_HEADER,
} from './session-constants';

const DEV_FALLBACK_SECRET = 'dev-only-secret-change-me-in-prod-please-xxxxxxxxxxxxxxxx';

/** Primary secret used when minting new sessions (see createSession). */
function signingSecret(): string {
  return process.env.AUTH_SECRET?.trim() || DEV_FALLBACK_SECRET;
}

/** Try multiple secrets so a rotated AUTH_SECRET does not brick every in-flight cookie at once. */
async function verifySessionJwt(token: string): Promise<JWTPayload | null> {
  const candidates: string[] = [];
  const primary = process.env.AUTH_SECRET?.trim();
  const previous = process.env.AUTH_SECRET_PREVIOUS?.trim();
  if (primary) candidates.push(primary);
  if (previous) candidates.push(previous);
  if (!primary && !previous) candidates.push(DEV_FALLBACK_SECRET);
  for (const s of candidates) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
      return payload;
    } catch {
      continue;
    }
  }
  return null;
}
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

function emailFromJwtPayload(payload: JWTPayload): string | null {
  const raw = payload as { email?: unknown };
  if (typeof raw.email === 'string' && raw.email.trim()) return raw.email.trim().toLowerCase();
  return null;
}

/** Collect session JWT from Cookie header(s) or middleware-forwarded header (see middleware.ts). */
export function getSessionTokenFromRequest(req: Request): string | null {
  const h = req.headers;
  return (
    getCookieFromHeader(h.get('cookie'), DRIVER_SESSION_COOKIE_NAME) ||
    getCookieFromHeader(h.get('Cookie'), DRIVER_SESSION_COOKIE_NAME) ||
    h.get(DRIVER_SESSION_FORWARD_HEADER)?.trim() ||
    null
  );
}

async function userFromSessionToken(token: string): Promise<User | null> {
  try {
    const payload = await verifySessionJwt(token);
    if (!payload) return null;

    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    const emailClaim = emailFromJwtPayload(payload);

    let raw: User | null = userId ? await findUserById(userId) : null;
    // After DB resets, JWT `sub` may not exist anymore; recover via email baked into newer tokens.
    if (!raw && emailClaim) {
      raw = await findUserByEmail(emailClaim);
    }
    // MVP: verified JWT but empty / new Postgres — bootstrap trusted owner row so admin works.
    if (!raw) {
      raw = await ensureTrustedAdminPlaceholder(userId, emailClaim);
    }
    if (!raw) return null;

    const user = applyTrustedAdminBypass(raw);
    if (user.role === 'driver' && user.driver_status !== 'active_compliant') return null;
    return user;
  } catch {
    return null;
  }
}

/** Use in Route Handlers when `cookies()` from next/headers does not see the session cookie. */
export async function getCurrentUserFromRequest(req: Request): Promise<User | null> {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  return userFromSessionToken(token);
}

export async function createSession(userId: string, email: string): Promise<void> {
  const token = await new SignJWT({
    sub: userId,
    email: email.trim().toLowerCase(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(signingSecret()));

  cookies().set(DRIVER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  cookies().delete(DRIVER_SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const h = headers();
  let token = cookies().get(DRIVER_SESSION_COOKIE_NAME)?.value ?? null;
  // Server Actions / Vercel sometimes omit `cookies()` or Cookie; middleware forwards JWT on x-shifty-session.
  if (!token) {
    token =
      getCookieFromHeader(h.get('cookie'), DRIVER_SESSION_COOKIE_NAME) ||
      getCookieFromHeader(h.get('Cookie'), DRIVER_SESSION_COOKIE_NAME) ||
      h.get(DRIVER_SESSION_FORWARD_HEADER)?.trim() ||
      null;
  }
  if (!token) return null;
  return userFromSessionToken(token);
}
