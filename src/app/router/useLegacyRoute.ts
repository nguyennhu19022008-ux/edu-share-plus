import { useEffect, useState } from 'react';
import { getCurrentPage, type LegacyPage } from '../legacyRouter';

export type LegacyRouteState = {
  page: LegacyPage;
  routeKey: string;
};

function readLegacyRoute(): LegacyRouteState {
  return {
    page: getCurrentPage(),
    // Giữ query string trong key để cùng một page nhưng id khác vẫn remount.
    // Ví dụ: ?page=detail&id=UI-001 -> ?page=detail&id=UI-002.
    routeKey: `${window.location.pathname}${window.location.search}`,
  };
}

export function useLegacyRoute(): LegacyRouteState {
  const [route, setRoute] = useState<LegacyRouteState>(() => readLegacyRoute());

  useEffect(() => {
    const syncRoute = () => setRoute(readLegacyRoute());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  return route;
}
