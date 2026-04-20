/**
 * Public site origin (https, no trailing slash).
 * Env can override (NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_BASE_URL).
 * localhost is ignored so bad Vercel env does not break production.
 *
 * Hardcode your main Vercel hostname here when env is unreliable.
 */
const HARDCODED_DEFAULT = 'https://shifty-phi.vercel.app';

function normalizeOrigin(raw: string): string {
  return raw.replace(/\/$/, '');
}

export const SITE_URL = normalizeOrigin(
  (() => {
    const a = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const b = process.env.NEXT_PUBLIC_BASE_URL?.trim();
    if (a && !a.includes('localhost')) return a;
    if (b && !b.includes('localhost')) return b;
    return HARDCODED_DEFAULT;
  })(),
);
