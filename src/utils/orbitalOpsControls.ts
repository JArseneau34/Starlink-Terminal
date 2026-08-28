import type { StarlinkCatalogPayload, StarlinkTleSource } from '../types/orbital';
import { allOrbitalShellFilterIndices } from '../data/orbitalShellClassification';

export type OrbitalOpsView =
  | 'ops'
  | 'fleet'
  | 'global'
  | 'manifest'
  | 'cams'
  | 'status'
  | 'settings'
  | 'deorbit';

export function toggleShellVisibility(
  prev: ReadonlySet<number>,
  shellIndex: number
): ReadonlySet<number> {
  const next = new Set(prev);
  if (next.has(shellIndex)) next.delete(shellIndex);
  else next.add(shellIndex);
  return next;
}

export function toggleAllShellVisibility(
  prev: ReadonlySet<number>,
  shellSlotCount: number
): ReadonlySet<number> {
  return prev.size >= shellSlotCount ? new Set<number>() : allOrbitalShellFilterIndices();
}

export function countVisibleCatalogNodes(
  visibleShells: ReadonlySet<number>,
  shellSlotCount: number,
  liveCatalog: StarlinkCatalogPayload | null | undefined
): number {
  if (visibleShells.size >= shellSlotCount) {
    return liveCatalog?.count ?? 0;
  }
  if (liveCatalog?.shells) {
    return liveCatalog.shells
      .filter((sh) => visibleShells.has(sh.index))
      .reduce((sum, sh) => sum + sh.count, 0);
  }
  if (liveCatalog) {
    return liveCatalog.satellites.filter((s) => visibleShells.has(s.shell)).length;
  }
  return 0;
}

export function formatTleSourceLabel(opts: {
  liveError: boolean;
  liveCatalogUnavailable: boolean;
  tleSource?: StarlinkTleSource | null;
}): string {
  // Unavailable = never answered / fetch error — not an answered empty list.
  if (opts.liveError || opts.liveCatalogUnavailable) return 'offline';
  const src = opts.tleSource;
  if (src === 'supgp') return 'CelesTrak SupGP';
  if (src === 'group' || src === 'gp') return 'CelesTrak GP';
  if (src === 'name') return 'CelesTrak name';
  if (src === 'tleapi') return 'TLE API';
  if (src === 'cache') return 'cached TLE';
  if (src === 'spacetrack-history') return 'Space-Track history';
  return 'CelesTrak TLE';
}

function parsePositiveIso(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return value;
}

/** Store clock on the globe payload. Epoch 0 / missing → never answered. */
export function catalogObservedAt(
  catalog:
    | {
        observed_at?: string | null;
        tleFetchedAt?: string | null;
      }
    | null
    | undefined
): string | null {
  if (!catalog) return null;
  if (Object.prototype.hasOwnProperty.call(catalog, 'observed_at')) {
    return parsePositiveIso(catalog.observed_at);
  }
  return parsePositiveIso(catalog.tleFetchedAt);
}

export function catalogHasTlePoints(
  catalog: { count?: number } | null | undefined
): boolean {
  return (catalog?.count ?? 0) > 0;
}

export type TleStripKind =
  | 'syncing'
  | 'offline'
  | 'stale_cache'
  | 'replay'
  | 'empty'
  | 'stale'
  | 'live';

export type TleStripTone = 'live' | 'stale' | 'offline' | 'plain';

export interface TleStripBadge {
  kind: TleStripKind;
  /** Badge text. null = no badge (answered empty — not “0 sats, live”). */
  label: string | null;
  title: string;
  tone: TleStripTone;
  /** Keep painting TLE points on the mesh. */
  paint: boolean;
  trackedText: string;
}

/**
 * TLE globe-strip state. Never-answered, empty, stale cache, and replay are
 * distinct. count === 0 is not “offline” and is not “live”.
 */
export function tleStripBadge(opts: {
  liveLoading: boolean;
  liveError: boolean;
  liveCatalog: {
    count: number;
    tleOffline?: boolean;
    tleFetchedAt?: string | null;
    observed_at?: string | null;
    playbackDate?: string | null;
  } | null | undefined;
  playbackDate?: string | null;
  catalogStale?: boolean;
}): TleStripBadge {
  const playbackDate = opts.playbackDate || opts.liveCatalog?.playbackDate || null;
  const hasPoints = catalogHasTlePoints(opts.liveCatalog);
  const observed = catalogObservedAt(opts.liveCatalog);
  const count = opts.liveCatalog?.count ?? 0;
  const trackedN = hasPoints ? count.toLocaleString() : '0';

  if (playbackDate) {
    return {
      kind: 'replay',
      label: 'replay',
      title: 'Reconstructed historical TLE. SGP4 at 12:00 UTC.',
      tone: 'stale',
      paint: hasPoints,
      trackedText: hasPoints ? trackedN : '—',
    };
  }

  if (hasPoints && (opts.liveCatalog?.tleOffline === true || opts.liveError)) {
    return {
      kind: 'stale_cache',
      label: 'stale cache',
      title: 'Upstream TLE fetch failed — serving last good cache',
      tone: 'stale',
      paint: true,
      trackedText: trackedN,
    };
  }

  if (opts.liveLoading && !hasPoints) {
    return {
      kind: 'syncing',
      label: 'syncing',
      title: 'Loading TLE catalog',
      tone: 'plain',
      paint: false,
      trackedText: '…',
    };
  }

  if (!hasPoints && (opts.liveError || observed == null)) {
    const neverLoaded = !opts.liveError && observed == null;
    return {
      kind: 'offline',
      label: neverLoaded ? 'never loaded' : 'offline',
      title: neverLoaded
        ? 'Catalog has never answered — nothing to paint'
        : 'TLE fetch failed — nothing to paint',
      tone: 'offline',
      paint: false,
      trackedText: '—',
    };
  }

  if (!hasPoints) {
    return {
      kind: 'empty',
      label: null,
      title: 'Catalog answered empty — not live',
      tone: 'plain',
      paint: false,
      trackedText: '0',
    };
  }

  if (opts.catalogStale) {
    return {
      kind: 'stale',
      label: 'stale',
      title: 'TLE cache older than the freshness threshold',
      tone: 'stale',
      paint: true,
      trackedText: trackedN,
    };
  }

  return {
    kind: 'live',
    label: 'live',
    title: 'Live TLE catalog',
    tone: 'live',
    paint: true,
    trackedText: trackedN,
  };
}

export function formatCatalogFreshnessLabel(
  tleFetchedAt: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!tleFetchedAt) return null;
  const ageMs = nowMs - Date.parse(tleFetchedAt);
  if (!Number.isFinite(ageMs)) return null;
  const mins = Math.round(ageMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

export function isCatalogStale(opts: {
  liveLoading: boolean;
  liveError: boolean;
  liveCatalog: StarlinkCatalogPayload | null | undefined;
  freshnessLabel: string | null;
  nowMs?: number;
  /** Hours after fetch before stale (default 2). */
  staleHours?: number;
}): boolean {
  const {
    liveLoading,
    liveError,
    liveCatalog,
    freshnessLabel,
    nowMs = Date.now(),
    staleHours = 2,
  } = opts;
  // Empty / loading stay not-stale so a first load never looks stale. Unknown
  // vs empty vs offline lives on tleStripBadge — this flag is age / tleOffline only.
  if (liveLoading || liveError || liveCatalog == null || liveCatalog.count <= 0) return false;
  if (liveCatalog.tleOffline === true) return true;
  if (freshnessLabel == null) return false;
  const thresholdMs = Math.max(0.25, staleHours) * 3_600_000;
  return nowMs - Date.parse(liveCatalog.tleFetchedAt) > thresholdMs;
}

export function orbitalOpsSubtitle(
  view: OrbitalOpsView,
  showGhostGrid: boolean
): string {
  if (view === 'ops') {
    return showGhostGrid
      ? 'live catalog · Walker reference grid'
      : 'live SupGP / GP catalog';
  }
  if (view === 'manifest') {
    return 'launch manifest · NET claims · corroboration';
  }
  if (view === 'cams') {
    return 'pad feeds · curated pad embeds · Manifest heat';
  }
  if (view === 'fleet') {
    return 'fleet data · launch archive · chart feeds · review queue';
  }
  if (view === 'status') {
    return 'operator status · readiness · setup · exports';
  }
  if (view === 'deorbit') {
    return 'deorbit board · decaying TLEs · Space-Track · SWPC';
  }
  if (view === 'settings') {
    return 'settings · display · polls · bloom · admin';
  }
  return 'global catalog · GCAT · all launches & satellites';
}

/**
 * Zoom LOD → edge draw stride (1 = every edge).
 * Cross-plane ISLs thin out sooner than intra-plane ring links.
 */
export function islEdgeDrawStride(lod: number, cross: boolean): number {
  if (lod < 0.45) return 1;
  if (lod < 0.9) return cross ? 2 : 1;
  if (lod < 1.15) return cross ? 3 : 2;
  return cross ? 4 : 2;
}

export function shouldDrawIslEdge(edgeIndex: number, cross: boolean, lod: number): boolean {
  const stride = islEdgeDrawStride(lod, cross);
  return edgeIndex % stride === 0;
}

/** Closed-label for the Orbital Ops view dropdown (Orion dock density). */
export function viewMenuSummary(opts: {
  autoSpin: boolean;
  showGhostGrid: boolean;
  showPlaneArcs: boolean;
  showCoverageCone: boolean;
}): string {
  const on: string[] = [];
  if (opts.autoSpin) on.push('auto-spin');
  if (opts.showGhostGrid) on.push('ghost');
  if (opts.showPlaneArcs) on.push('arcs');
  if (opts.showCoverageCone) on.push('coverage');
  return on.length ? on.join(' · ') : 'off';
}
