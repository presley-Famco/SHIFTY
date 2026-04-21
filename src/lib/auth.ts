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
  DRIVER_SESSION_MAX_AGE_SEC,
  DRIVER_SESSION_PUBLIC_COOKIE_NAME,
  shouldMirrorSessionToPublicCookie,
} from './session-constants';

const DEV_FALLBACK_SECRET = 'dev-only-secret-change-me-in-prod-please-xxxxxxxxxxxxxxxx';

/** Primary secret used when minting new sessions (see createSession). */
function signingSecret(): string {
  return process.env.AUTH_SECRET?.trim() || DEV_FALLBACK_SECRET;
}

function bearerFromAuthorization(header: string | null): string | null {
  const h = header?.trim();
  if (!h) return null;
  const low = h.toLowerCase();
  if (!low.startsWith('bearer ')) return null;
  const t = h.slice(7).trim();
  return t || null;
}

/** Try multiple secrets; always try dev fallback last so bad AUTH_SECRET env does not brick everyone. */
async function verifySessionJwt(token: string): Promise<JWTPayload | null> {
  const primary = process.env.AUTH_SECRET?.trim();
  const previous = process.env.AUTH_SECRET_PREVIOUS?.trim();
  const ordered: string[] = [];
  if (primary) ordered.push(primary);
  if (previous) ordered.push(previous);
  if (!primary && !previous) ordered.push(DEV_FALLBACK_SECRET);
  if (!ordered.includes(DEV_FALLBACK_SECRET)) ordered.push(DEV_FALLBACK_SECRET);

  const seen = new Set<string>();
  for (const s of ordered) {
    if (seen.has(s)) continue;
    seen.add(s);
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
      return payload;
    } catch {
      continue;
    }
  }
  return null;
}

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

/** Collect session JWT from cookies, middleware forward, or Authorization Bearer (from admin-fetch). */
export function getSessionTokenFromRequest(req: Request): string | null {
  return getSessionTokensFromRequest(req)[0] ?? null;
}

function uniqueTokens(tokens: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const trimmed = token?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function getSessionTokensFromRequest(req: Request): string[] {
  const h = req.headers;
  return uniqueTokens([
    bearerFromAuthorization(h.get('authorization')) ||
      bearerFromAuthorization(h.get('Authorization')),
    h.get(DRIVER_SESSION_FORWARD_HEADER),
    getCookieFromHeader(h.get('cookie'), DRIVER_SESSION_COOKIE_NAME) ||
      getCookieFromHeader(h.get('Cookie'), DRIVER_SESSION_COOKIE_NAME),
    getCookieFromHeader(h.get('cookie'), DRIVER_SESSION_PUBLIC_COOKIE_NAME) ||
      getCookieFromHeader(h.get('Cookie'), DRIVER_SESSION_PUBLIC_COOKIE_NAME),
  ]);
}

async function firstUserFromSessionTokens(tokens: string[]): Promise<User | null> {
  for (const token of tokens) {
    const user = await userFromSessionToken(token);
    if (user) return user;
  }
  return null;
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
  const user = await firstUserFromSessionTokens(getSessionTokensFromRequest(req));
  if (user) return user;

  // Route Handlers can sometimes miss the raw cookie/header that RSC sees reliably via next/headers.
  // Fall back to the same resolver used by layouts/pages so admin page access and admin API access stay aligned.
  return await getCurrentUser();
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
    maxAge: DRIVER_SESSION_MAX_AGE_SEC,
  });

  if (shouldMirrorSessionToPublicCookie()) {
    cookies().set(DRIVER_SESSION_PUBLIC_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: DRIVER_SESSION_MAX_AGE_SEC,
    });
  }
}

export async function destroySession(): Promise<void> {
  cookies().delete(DRIVER_SESSION_COOKIE_NAME);
  cookies().delete(DRIVER_SESSION_PUBLIC_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const h = headers();
  const cookieApiToken =
    cookies().get(DRIVER_SESSION_COOKIE_NAME)?.value ??
    cookies().get(DRIVER_SESSION_PUBLIC_COOKIE_NAME)?.value ??
    null;
  // Server Actions / Vercel sometimes omit `cookies()` or Cookie; middleware forwards JWT on x-shifty-session.
  return firstUserFromSessionTokens(
    uniqueTokens([
      bearerFromAuthorization(h.get('authorization')) ||
        bearerFromAuthorization(h.get('Authorization')),
      h.get(DRIVER_SESSION_FORWARD_HEADER),
      cookieApiToken,
      getCookieFromHeader(h.get('cookie'), DRIVER_SESSION_COOKIE_NAME) ||
        getCookieFromHeader(h.get('Cookie'), DRIVER_SESSION_COOKIE_NAME),
      getCookieFromHeader(h.get('cookie'), DRIVER_SESSION_PUBLIC_COOKIE_NAME) ||
        getCookieFromHeader(h.get('Cookie'), DRIVER_SESSION_PUBLIC_COOKIE_NAME),
    ]),
  );
}
