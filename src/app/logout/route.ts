import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

/** Prefer env when set to a real deploy URL; ignore accidental localhost in production. */
function homeRedirectUrl(request: Request): URL {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env && !env.includes('localhost')) {
    return new URL('/', env.endsWith('/') ? env.slice(0, -1) : env);
  }
  return new URL('/', new URL(request.url).origin);
}

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(homeRedirectUrl(request));
}

export async function POST(request: Request) {
  await destroySession();
  return NextResponse.redirect(homeRedirectUrl(request));
}
