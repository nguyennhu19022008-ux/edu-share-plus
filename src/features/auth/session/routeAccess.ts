import { LEGACY_PAGES, type LegacyPage } from '../../../app/legacyRouter';

const STUDENT_PROTECTED_PAGES = new Set<LegacyPage>([
  'index',
  'add',
  'editPost',
  'detail',
  'myPosts',
  'myDetail',
  'profile',
]);

export function isStudentProtectedPage(page: LegacyPage) {
  return STUDENT_PROTECTED_PAGES.has(page);
}

export function currentRelativeTarget() {
  return `${window.location.pathname}${window.location.search}`;
}

export function readSafeStudentReturnTarget(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next) return null;

  try {
    const target = new URL(next, window.location.origin);
    if (target.origin !== window.location.origin) return null;
    if (target.pathname !== window.location.pathname) return null;

    const page = target.searchParams.get('page') || 'landing';
    if (!LEGACY_PAGES.includes(page as LegacyPage)) return null;
    if (!isStudentProtectedPage(page as LegacyPage)) return null;

    return `${target.pathname}${target.search}`;
  } catch {
    return null;
  }
}

export function navigateToRelativeTarget(target: string) {
  const url = new URL(target, window.location.origin);
  window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
