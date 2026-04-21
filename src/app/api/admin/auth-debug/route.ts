import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentUserFromRequest, getSessionTokenFromRequest } from '@/lib/auth';
import { findUserById } from '@/lib/db';

export const runtime = 'nodejs';

function postgresHostHint(): string | null {
  const raw = process.env.POSTGRES_URL;
  if (!raw || typeof raw !== 'string') return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return '(unparseable POSTGRES_URL)';
  }
}

function jwtSubUnverified(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      sub?: unknown;
    };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function emailUnverified(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      email?: unknown;
    };
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

/**
 * Same auth path as /api/admin/* route handlers (getCurrentUserFromRequest).
 * GET with header x-session-debug matching SESSION_DEBUG_SECRET.
 *
 * Response fields are intentionally minimal — see mismatch_notes for diagnosis.
 */
export async function GET(req: Request) {
  const expected = process.env.SESSION_DEBUG_SECRET?.trim();
  const sent = req.headers.get('x-session-debug')?.trim();
  const reqToken = getSessionTokenFromRequest(req);
  const reqJwtSub = reqToken ? jwtSubUnverified(reqToken) : null;
  const reqJwtEmail = reqToken ? emailUnverified(reqToken) : null;
  const reqDbUser = reqJwtSub ? await findUserById(reqJwtSub) : null;

  const requestUser = await getCurrentUserFromRequest(req);
  const nextHeadersUser = await getCurrentUser();
  const secretOk = !!expected && sent === expected;
  const allowFull = secretOk || requestUser?.role === 'admin' || nextHeadersUser?.role === 'admin';

  const compact = (u: NonNullable<Awaited<ReturnType<typeof getCurrentUserFromRequest>>>) =>
    ({
      id: u.id,
      email: u.email,
      role: u.role,
      driver_status: u.driver_status,
    }) as const;

  return NextResponse.json({
    postgresHostFromEnv: postgresHostHint(),
    detailLevel: allowFull ? 'full' : 'limited',
    requestTokenFound: !!reqToken,
    requestJwtSubject_unverified: reqJwtSub,
    requestJwtEmail_unverified: allowFull ? reqJwtEmail : null,
    dbUserForRequestJwtSubject:
      allowFull && reqDbUser &&
      ({
        id: reqDbUser.id,
        email: reqDbUser.email,
        role: reqDbUser.role,
        driver_status: reqDbUser.driver_status,
      } as const),
    getCurrentUserFromRequest: allowFull && requestUser ? compact(requestUser) : null,
    getCurrentUser: allowFull && nextHeadersUser ? compact(nextHeadersUser) : null,
    mismatch_notes: [
      !reqToken ? 'No token on this request (cookie / Authorization / forwarded header).' : null,
      reqJwtSub && !reqDbUser ? 'JWT sub does not exist in this database (wrong Neon branch or stale token).' : null,
      reqDbUser && reqDbUser.role !== 'admin'
        ? 'DB row for JWT sub is not role admin (trusted-admin bypass may still upgrade in app — see db.ts).'
        : null,
      !requestUser ? 'getCurrentUserFromRequest returned null (would 403 admin APIs).' : null,
      requestUser?.role !== 'admin' ? 'getCurrentUserFromRequest resolved a non-admin user.' : null,
      requestUser && nextHeadersUser && requestUser.id !== nextHeadersUser.id
        ? 'Route handler auth and next/headers auth resolved different user ids.'
        : null,
      requestUser && nextHeadersUser && requestUser.role !== nextHeadersUser.role
        ? 'Route handler auth and next/headers auth disagree on role.'
        : null,
    ].filter(Boolean),
  });
}
