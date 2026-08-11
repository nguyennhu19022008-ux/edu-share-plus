export const LEGACY_PAGES = [
  'landing',
  'loginStudent',
  'registerStudent',
  'loginGV',
  'index',
  'add',
  'editPost',
  'detail',
  'myPosts',
  'myDetail',
  'profile',
  'admin',
] as const;

export type LegacyPage = (typeof LEGACY_PAGES)[number];

export function getCurrentPage(): LegacyPage {
  const page = new URLSearchParams(window.location.search).get('page') || 'landing';
  return LEGACY_PAGES.includes(page as LegacyPage) ? (page as LegacyPage) : 'landing';
}

export function navigateLegacy(page: LegacyPage, params: Record<string, string> = {}): void {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  if (page !== 'landing') url.searchParams.set('page', page);
  Object.entries(params).forEach(([key, value]) => {
    const safeValue = String(value ?? '').trim();
    if (safeValue) url.searchParams.set(key, safeValue);
  });
  window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
