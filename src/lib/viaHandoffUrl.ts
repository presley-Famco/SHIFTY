/** Official Via Driver listings (handoff after inspection when no custom deep link is configured). */
export const VIA_APP_STORE_URL =
  'https://apps.apple.com/us/app/via-driver/id1121194508';
export const VIA_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=via.driver&hl=en_US';

/**
 * Picks App Store vs Play Store when `NEXT_PUBLIC_VIA_REDIRECT_URL` is not set.
 * Call only in the browser (e.g. after inspection submit).
 */
export function getClientDefaultViaHandoffUrl(): string {
  if (typeof navigator === 'undefined') return VIA_APP_STORE_URL;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return VIA_PLAY_STORE_URL;
  if (/iPhone|iPad|iPod/i.test(ua)) return VIA_APP_STORE_URL;
  return VIA_APP_STORE_URL;
}

export function resolveViaHandoffUrl(explicit?: string | null): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  return getClientDefaultViaHandoffUrl();
}
