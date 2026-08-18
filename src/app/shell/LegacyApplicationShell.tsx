import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { navigateLegacy } from '../legacyRouter';
import { getRouteDefinition, ROUTE_BODY_CLASSES } from '../router/routeRegistry';
import { useLegacyRoute } from '../router/useLegacyRoute';
import { useStudentAuth } from '../../features/auth/session/AuthSessionProvider';
import {
  currentRelativeTarget,
  isStudentProtectedPage,
} from '../../features/auth/session/routeAccess';
import { inspectExistingStaffSession } from '../../features/auth/staff/staffAuthService';
import RouteErrorBoundary from './RouteErrorBoundary';
import RouteLoading from './RouteLoading';

type StaffGateState = 'idle' | 'checking' | 'allowed' | 'denied';

export default function LegacyApplicationShell() {
  const route = useLegacyRoute();
  const definition = getRouteDefinition(route.page);
  const RouteComponent = definition.component;

  const auth = useStudentAuth();
  const protectedStudentRoute = isStudentProtectedPage(route.page);

  const protectedStaffRoute = route.page === 'admin';
  const [staffGate, setStaffGate] = useState<StaffGateState>(
    protectedStaffRoute ? 'checking' : 'idle',
  );
  const [lifecycleVersion, setLifecycleVersion] = useState(0);

  useLayoutEffect(() => {
    document.title = definition.title;

    ROUTE_BODY_CLASSES.forEach((className) =>
      document.body.classList.remove(className),
    );

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

  // Re-check database authorization whenever the browser returns to the app.
  // This catches role/status changes that are not encoded in the current JWT.
  useEffect(() => {
    const bumpLifecycle = () => {
      setLifecycleVersion((value) => value + 1);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        bumpLifecycle();
      }
    };

    window.addEventListener('focus', bumpLifecycle);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', bumpLifecycle);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Student role/status is database-backed, so refresh it on protected-route
  // entry, foreground return and token lifecycle changes.
  useEffect(() => {
    if (!protectedStudentRoute || !auth.authReady || !auth.session) {
      return;
    }

    void auth.refreshProfile();
  }, [
    auth.authReady,
    auth.refreshProfile,
    auth.session?.access_token,
    lifecycleVersion,
    protectedStudentRoute,
    route.routeKey,
  ]);

  useEffect(() => {
    if (!protectedStudentRoute || !auth.authReady || auth.profileLoading) {
      return;
    }

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

  useEffect(() => {
    if (!protectedStaffRoute) {
      setStaffGate('idle');
      return;
    }

    let cancelled = false;
    setStaffGate('checking');

    const verifyStaffAccess = async () => {
      const next = currentRelativeTarget();

      try {
        const state = await inspectExistingStaffSession();

        if (cancelled) return;

        if (state.kind === 'staff') {
          setStaffGate('allowed');
          return;
        }

        setStaffGate('denied');

        navigateLegacy('loginGV', {
          status: 'staff_required',
          next,
        });
      } catch {
        if (cancelled) return;

        setStaffGate('denied');

        navigateLegacy('loginGV', {
          status: 'staff_session_error',
          next,
        });
      }
    };

    void verifyStaffAccess();

    return () => {
      cancelled = true;
    };
  }, [
    auth.session?.access_token,
    lifecycleVersion,
    protectedStaffRoute,
    route.routeKey,
  ]);

  if (protectedStudentRoute) {
    if (!auth.authReady || auth.profileLoading) {
      return <RouteLoading />;
    }

    if (
      !auth.session
      || !auth.profile
      || auth.profile.accountStatus !== 'approved'
    ) {
      return <RouteLoading />;
    }
  }

  if (protectedStaffRoute && staffGate !== 'allowed') {
    return <RouteLoading />;
  }

  return (
    <RouteErrorBoundary key={`boundary:${route.routeKey}`}>
      <Suspense fallback={<RouteLoading />}>
        <RouteComponent key={route.routeKey} />
      </Suspense>
    </RouteErrorBoundary>
  );
}
