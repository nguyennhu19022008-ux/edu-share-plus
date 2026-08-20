export interface SafeReturnTargetInput {
  search: string;
  origin: string;
  pathname: string;
  isKnownPage: (page: string) => boolean;
  isProtectedPage: (page: string) => boolean;
}

export function readSafeReturnTarget({
  search,
  origin,
  pathname,
  isKnownPage,
  isProtectedPage,
}: SafeReturnTargetInput): string | null {
  const next = new URLSearchParams(search).get('next');
  if (!next) return null;

  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return null;
    if (target.pathname !== pathname) return null;

    const page = target.searchParams.get('page') || 'landing';
    if (!isKnownPage(page)) return null;
    if (!isProtectedPage(page)) return null;

    return `${target.pathname}${target.search}`;
  } catch {
    return null;
  }
}
