export const PRODUCTION_SITE_URL = 'https://edu-share-pink.vercel.app';

export function resolvePublicSiteOrigin(): string {
  if (typeof window === 'undefined') {
    return PRODUCTION_SITE_URL;
  }

  const origin = window.location.origin;
  // If the browser is on localhost or local IP, redirect to the production Vercel app
  // so confirmation emails can be opened on phones and other devices seamlessly
  if (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('192.168.') ||
    origin.includes('172.')
  ) {
    const envAppUrl = import.meta.env.VITE_APP_URL?.trim();
    return envAppUrl || PRODUCTION_SITE_URL;
  }

  return origin;
}

export function getStudentConfirmRedirectUrl(): string {
  const baseOrigin = resolvePublicSiteOrigin();
  const url = new URL('/', baseOrigin);
  url.searchParams.set('page', 'loginStudent');
  url.searchParams.set('confirmed', '1');
  return url.toString();
}

export function getPasswordResetRedirectUrl(portal: 'student' | 'teacher'): string {
  const baseOrigin = resolvePublicSiteOrigin();
  const url = new URL('/', baseOrigin);
  url.searchParams.set('page', 'updatePassword');
  url.searchParams.set('portal', portal);
  return url.toString();
}
