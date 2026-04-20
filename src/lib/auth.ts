import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { findUserById, type User } from './db';

function authSecretBytes(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    'dev-only-secret-change-me-in-prod-please-xxxxxxxxxxxxxxxx';
  return new TextEncoder().encode(raw);
}
const COOKIE_NAME = 'driver_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecretBytes());
    const userId = payload.sub;
    if (typeof userId !== 'string') return null;
    const user = await findUserById(userId);
    if (!user) return null;
    if (user.role === 'driver' && user.driver_status !== 'active_compliant') return null;
    return user;
  } catch {
    return null;
  }
}
