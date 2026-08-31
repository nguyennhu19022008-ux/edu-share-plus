export const LEGACY_PAGES = [
  'landing',
  'loginStudent',
  'registerStudent',
  'loginGV',
  'forgotPassword',
  'updatePassword',
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

const PAGE_ALIASES: Record<string, LegacyPage> = {
  login: 'loginStudent',
  loginStudent: 'loginStudent',
  signin: 'loginStudent',
  register: 'registerStudent',
  registerStudent: 'registerStudent',
  signup: 'registerStudent',
  loginTeacher: 'loginGV',
  loginGV: 'loginGV',
  teacherLogin: 'loginGV',
  market: 'index',
  marketplace: 'index',
  index: 'index',
  posts: 'myPosts',
  myPosts: 'myPosts',
  detail: 'detail',
  myDetail: 'myDetail',
  add: 'add',
  edit: 'editPost',
  editPost: 'editPost',
  profile: 'profile',
  admin: 'admin',
  landing: 'landing',
  home: 'landing',
};

export function getCurrentPage(): LegacyPage {
  const rawPage = new URLSearchParams(window.location.search).get('page') || 'landing';
  return PAGE_ALIASES[rawPage] || (LEGACY_PAGES.includes(rawPage as LegacyPage) ? (rawPage as LegacyPage) : 'landing');
}

export function navigateLegacy(
  page: LegacyPage,
  params: Record<string, string> = {},
): void {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';

  if (page !== 'landing') {
    url.searchParams.set('page', page);
  }

  Object.entries(params).forEach(([key, value]) => {
    const safeValue = String(value ?? '').trim();
    if (safeValue) {
      url.searchParams.set(key, safeValue);
    }
  });

  window.history.pushState(
    {},
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
}
