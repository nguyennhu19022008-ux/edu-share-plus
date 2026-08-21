import { LEGACY_PAGES, type LegacyPage } from '../../../app/legacyRouter';
import { readSafeReturnTarget } from './routeAccessCore';

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
  return readSafeReturnTarget({
    search: window.location.search,
    origin: window.location.origin,
    pathname: window.location.pathname,
    isKnownPage: (page) => LEGACY_PAGES.includes(page as LegacyPage),
    isProtectedPage: (page) => isStudentProtectedPage(page as LegacyPage),
  });
}

export function navigateToRelativeTarget(target: string) {
  const url = new URL(target, window.location.origin);
  window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
