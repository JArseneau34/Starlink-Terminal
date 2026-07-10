import type {
  GlobalCatalogDashboard,
  GlobalCatalogFeeds,
  GlobalCatalogNested,
  GlobalCatalogObjectKindRow,
  GlobalCatalogSatKind,
  GlobalCatalogViewScope,
} from '../types/globalCatalog';

export function pickGlobalView<T>(payload: GlobalCatalogNested<T> | null | undefined, view: GlobalCatalogViewScope): T | GlobalCatalogScopedWithKinds<T> {
  if (!payload) return {} as T;
  const scoped = payload as { orbital?: T; all?: T };
  if (scoped[view] !== undefined) return scoped[view] as T;
  if (scoped.orbital !== undefined || scoped.all !== undefined) {
    return (scoped.orbital ?? scoped.all ?? {}) as T;
  }
  return payload as T;
}

type GlobalCatalogScopedWithKinds<T> = T & {
  object_kinds?: GlobalCatalogObjectKindRow[];
};

export function pickGlobalKind<T>(
  viewPayload: T | null | undefined,
  kind: GlobalCatalogSatKind
): T {
  if (!viewPayload) return {} as T;
  const nested = viewPayload as Record<string, unknown> & {
    payloads?: T;
    non_payloads?: T;
  };
  if (nested[kind] !== undefined) return nested[kind] as T;
  if (nested.payloads !== undefined || nested.non_payloads !== undefined) {
    return (nested.payloads ?? nested.non_payloads ?? {}) as T;
  }
  return viewPayload;
}

export function resolveGlobalDashboard(
  snapshotDashboard: GlobalCatalogNested<GlobalCatalogDashboard> | undefined,
  view: GlobalCatalogViewScope,
  kind: GlobalCatalogSatKind
): { dashboard: GlobalCatalogDashboard; objectKinds: GlobalCatalogObjectKindRow[] } {
  const dashView = pickGlobalView(snapshotDashboard, view) as GlobalCatalogDashboard & {
    object_kinds?: GlobalCatalogObjectKindRow[];
  };
  const objectKinds = dashView.object_kinds ?? [];
  const dashboard = pickGlobalKind(dashView, kind);
  return { dashboard, objectKinds };
}

export function resolveGlobalFeeds(
  snapshotFeeds: GlobalCatalogNested<GlobalCatalogFeeds> | undefined,
  view: GlobalCatalogViewScope,
  kind: GlobalCatalogSatKind
): GlobalCatalogFeeds {
  const feedsView = pickGlobalView(snapshotFeeds, view);
  return pickGlobalKind(feedsView, kind);
}
