import { Suspense, useLayoutEffect } from 'react';
import { getRouteDefinition, ROUTE_BODY_CLASSES } from '../router/routeRegistry';
import { useLegacyRoute } from '../router/useLegacyRoute';
import RouteErrorBoundary from './RouteErrorBoundary';
import RouteLoading from './RouteLoading';

export default function LegacyApplicationShell() {
  const route = useLegacyRoute();
  const definition = getRouteDefinition(route.page);
  const RouteComponent = definition.component;

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

  return (
    <RouteErrorBoundary key={`boundary:${route.routeKey}`}>
      <Suspense fallback={<RouteLoading />}>
        <RouteComponent key={route.routeKey} />
      </Suspense>
    </RouteErrorBoundary>
  );
}
