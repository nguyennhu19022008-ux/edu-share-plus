import { Suspense, useEffect, useLayoutEffect } from 'react';
import { navigateLegacy } from '../legacyRouter';
import { getRouteDefinition, ROUTE_BODY_CLASSES } from '../router/routeRegistry';
import { useLegacyRoute } from '../router/useLegacyRoute';
import { useStudentAuth } from '../../features/auth/session/AuthSessionProvider';
import {
  currentRelativeTarget,
  isStudentProtectedPage,
} from '../../features/auth/session/routeAccess';
import RouteErrorBoundary from './RouteErrorBoundary';
import RouteLoading from './RouteLoading';

export default function LegacyApplicationShell() {
  const route = useLegacyRoute();
  const definition = getRouteDefinition(route.page);
  const RouteComponent = definition.component;
  const auth = useStudentAuth();
  const protectedStudentRoute = isStudentProtectedPage(route.page);

  useLayoutEffect(() => {
    document.title = definition.title;

    // Chỉ quản lý các class thuộc page shell. Class trạng thái tạm thời như
    // `admin-modal-open` vẫn do feature sở hữu và không bị xóa ở đây.
    ROUTE_BODY_CLASSES.forEach((className) => document.body.classList.remove(className));
    definition.bodyClass
      .split(/\s+/)
      .filter(Boolean)
      .forEach((className) => document.body.classList.add(className));

    return () => {
      definition.bodyClass
        .split(/\s+/)
        .filter(Boolean)
        .forEach((className) => document.body.classList.remove(className));
    };
  }, [definition]);

  useEffect(() => {
    if (!protectedStudentRoute || !auth.authReady || auth.profileLoading) return;

    const next = currentRelativeTarget();

    if (!auth.session) {
      navigateLegacy('loginStudent', { next });
      return;
    }

    if (!auth.profile) {
      navigateLegacy('loginStudent', {
        status: 'profile_error',
        next,
      });
      return;
    }

    if (auth.profile.accountStatus !== 'approved') {
      navigateLegacy('loginStudent', {
        status: auth.profile.accountStatus,
        next,
      });
    }
  }, [
    auth.authReady,
    auth.profile,
    auth.profileLoading,
    auth.session,
    protectedStudentRoute,
    route.routeKey,
  ]);

  if (protectedStudentRoute) {
    if (!auth.authReady || auth.profileLoading) return <RouteLoading />;
    if (!auth.session || !auth.profile || auth.profile.accountStatus !== 'approved') return <RouteLoading />;
  }

  return (
    <RouteErrorBoundary key={`boundary:${route.routeKey}`}>
      <Suspense fallback={<RouteLoading />}>
        <RouteComponent key={route.routeKey} />
      </Suspense>
    </RouteErrorBoundary>
  );
}
