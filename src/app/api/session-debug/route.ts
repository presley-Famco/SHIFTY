import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findUserById } from '@/lib/db';
import { DRIVER_SESSION_COOKIE_NAME, DRIVER_SESSION_FORWARD_HEADER } from '@/lib/session-constants';

export const runtime = 'nodejs';

/** Parse Postgres URL hostname only (no secrets). */
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

function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === DRIVER_SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

/**
 * Temporary troubleshooting: compare session cookie ↔ DB ↔ POSTGRES host.
 * Set SESSION_DEBUG_SECRET in Vercel, redeploy, then GET with header:
 *   x-session-debug: <same secret>
 */
export async function GET(req: Request) {
  const expected = process.env.SESSION_DEBUG_SECRET?.trim();
  const sent = req.headers.get('x-session-debug')?.trim();
  if (!expected) {
    return NextResponse.json(
      {
        error:
          'SESSION_DEBUG_SECRET is not set for this deployment. In Vercel → Settings → Environment Variables, add SESSION_DEBUG_SECRET for Preview AND Production (whichever matches this URL), redeploy, then retry with header x-session-debug matching that value exactly.',
      },
      { status: 503 },
    );
  }
  if (sent !== expected) {
    return NextResponse.json(
      {
        error:
          'Missing or wrong x-session-debug header. It must match SESSION_DEBUG_SECRET in Vercel exactly (same spelling, spaces, Preview vs Production scope).',
      },
      { status: 401 },
    );
  }

  const h = headers();
  const cookieApi = cookies().get(DRIVER_SESSION_COOKIE_NAME)?.value ?? null;
  const cookieHdr = h.get('cookie');
  const tokenFromHdr = tokenFromCookieHeader(cookieHdr);
  const tokenFromForward = h.get(DRIVER_SESSION_FORWARD_HEADER)?.trim() ?? null;

  const token = cookieApi ?? tokenFromHdr ?? tokenFromForward;
  const jwtSub = token ? jwtSubUnverified(token) : null;

  const user = await getCurrentUser();
  const bySub = jwtSub ? await findUserById(jwtSub) : null;

  const host = h.get('host');
  const forwardedHost = h.get('x-forwarded-host');

  return NextResponse.json({
    requestHost: host,
    forwardedHost,
    postgresHostFromEnv: postgresHostHint(),
    cookiePresent_cookiesApi: !!cookieApi,
    cookiePresent_rawHeader: !!tokenFromHdr,
    middlewareForwardedSession: !!tokenFromForward,
    jwtSubject_unverified: jwtSub,
    getCurrentUser:
      user &&
      ({
        id: user.id,
        email: user.email,
        role: user.role,
      } as const),
    dbUserForJwtSubject:
      bySub &&
      ({
        id: bySub.id,
        email: bySub.email,
        role: bySub.role,
      } as const),
    mismatch_notes: [
      !jwtSub && !user ? 'No session token found (not logged in or cookie blocked).' : null,
      jwtSub && !bySub ? 'JWT points to user id not in THIS database — wrong POSTGRES_URL or stale token.' : null,
      jwtSub && bySub && user && jwtSub !== user.id ? 'JWT sub differs from getCurrentUser id (unexpected).' : null,
      user?.role !== 'admin' ? 'Resolved user is not admin — role in DB for this connection is what matters.' : null,
    ].filter(Boolean),
  });
}
