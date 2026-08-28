import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  catalogHasTlePoints,
  catalogObservedAt,
  countVisibleCatalogNodes,
  formatCatalogFreshnessLabel,
  formatTleSourceLabel,
  islEdgeDrawStride,
  isCatalogStale,
  orbitalOpsSubtitle,
  shouldDrawIslEdge,
  tleStripBadge,
  toggleAllShellVisibility,
  toggleShellVisibility,
  viewMenuSummary,
} from './orbitalOpsControls.ts';
import type { StarlinkCatalogPayload } from '../types/orbital.ts';

function catalog(partial: Partial<StarlinkCatalogPayload> & Pick<StarlinkCatalogPayload, 'count'>): StarlinkCatalogPayload {
  return {
    referenceTime: '2026-07-01T00:00:00.000Z',
    tleFetchedAt: '2026-07-01T00:00:00.000Z',
    fetchedAt: '2026-07-01T00:00:00.000Z',
    satellites: [],
    shells: [],
    lat: [],
    lon: [],
    altKm: [],
    velLat: [],
    velLon: [],
    velAlt: [],
    tleSource: 'group',
    tleOffline: false,
    ...partial,
  };
}

describe('orbitalOpsControls', () => {
  it('toggleShellVisibility adds and removes', () => {
    const a = toggleShellVisibility(new Set([1, 2]), 3);
    assert.ok(a.has(3));
    assert.equal(a.size, 3);
    const b = toggleShellVisibility(a, 2);
    assert.ok(!b.has(2));
    assert.equal(b.size, 2);
  });

  it('toggleAllShellVisibility clears when full and restores when empty', () => {
    const full = toggleAllShellVisibility(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]), 9);
    assert.equal(full.size, 0);
    const restored = toggleAllShellVisibility(full, 9);
    assert.equal(restored.size, 9);
  });

  it('countVisibleCatalogNodes respects shell filter', () => {
    const live = catalog({
      count: 100,
      shells: [
        { index: 0, name: 'a', inclination: 53, count: 40, color: 0 },
        { index: 1, name: 'b', inclination: 53, count: 60, color: 0 },
      ],
    });
    assert.equal(countVisibleCatalogNodes(new Set([0, 1]), 2, live), 100);
    assert.equal(countVisibleCatalogNodes(new Set([0]), 2, live), 40);
  });

  it('formatTleSourceLabel covers offline and sources', () => {
    assert.equal(
      formatTleSourceLabel({ liveError: true, liveCatalogUnavailable: false }),
      'offline'
    );
    assert.equal(
      formatTleSourceLabel({
        liveError: false,
        liveCatalogUnavailable: true,
      }),
      'offline'
    );
    assert.equal(
      formatTleSourceLabel({
        liveError: false,
        liveCatalogUnavailable: false,
        tleSource: 'tleapi',
      }),
      'TLE API'
    );
  });

  it('formatCatalogFreshnessLabel and isCatalogStale guard the 83B-era stale UI', () => {
    const now = Date.parse('2026-07-13T12:00:00.000Z');
    assert.equal(formatCatalogFreshnessLabel('2026-07-13T11:50:00.000Z', now), '10m ago');
    const fresh = catalog({
      count: 10,
      tleFetchedAt: '2026-07-13T11:00:00.000Z',
      tleOffline: false,
    });
    assert.equal(
      isCatalogStale({
        liveLoading: false,
        liveError: false,
        liveCatalog: fresh,
        freshnessLabel: '1h ago',
        nowMs: now,
      }),
      false
    );
    const stale = catalog({
      count: 10,
      tleFetchedAt: '2026-07-13T08:00:00.000Z',
      tleOffline: false,
    });
    assert.equal(
      isCatalogStale({
        liveLoading: false,
        liveError: false,
        liveCatalog: stale,
        freshnessLabel: '4h ago',
        nowMs: now,
      }),
      true
    );
  });

  it('isCatalogStale is false while empty or loading (first load never looks stale)', () => {
    const empty = catalog({
      count: 0,
      tleFetchedAt: '2026-07-13T08:00:00.000Z',
      tleOffline: false,
    });
    assert.equal(
      isCatalogStale({
        liveLoading: false,
        liveError: false,
        liveCatalog: empty,
        freshnessLabel: '4h ago',
        nowMs: Date.parse('2026-07-13T12:00:00.000Z'),
      }),
      false
    );
    const loading = catalog({ count: 10, tleFetchedAt: '2026-07-13T08:00:00.000Z' });
    assert.equal(
      isCatalogStale({
        liveLoading: true,
        liveError: false,
        liveCatalog: loading,
        freshnessLabel: '4h ago',
        nowMs: Date.parse('2026-07-13T12:00:00.000Z'),
      }),
      false
    );
  });

  it('tleStripBadge: never-answered vs empty vs stale vs replay', () => {
    assert.equal(
      tleStripBadge({ liveLoading: true, liveError: false, liveCatalog: null }).kind,
      'syncing'
    );
    assert.equal(
      tleStripBadge({ liveLoading: true, liveError: false, liveCatalog: null }).label,
      'syncing'
    );

    const never = tleStripBadge({
      liveLoading: false,
      liveError: false,
      liveCatalog: catalog({ count: 0, observed_at: null, tleFetchedAt: '1970-01-01T00:00:00.000Z' }),
    });
    assert.equal(never.kind, 'offline');
    assert.equal(never.label, 'never loaded');
    assert.equal(never.paint, false);
    assert.equal(never.trackedText, '—');
    assert.equal(catalogObservedAt({ observed_at: null, tleFetchedAt: '1970-01-01T00:00:00.000Z' }), null);

    const err = tleStripBadge({ liveLoading: false, liveError: true, liveCatalog: null });
    assert.equal(err.kind, 'offline');
    assert.equal(err.label, 'offline');
    assert.equal(err.paint, false);

    const empty = tleStripBadge({
      liveLoading: false,
      liveError: false,
      liveCatalog: catalog({
        count: 0,
        observed_at: '2026-08-01T00:00:00.000Z',
        tleFetchedAt: '2026-08-01T00:00:00.000Z',
        tleOffline: false,
      }),
    });
    assert.equal(empty.kind, 'empty');
    assert.equal(empty.label, null);
    assert.notEqual(empty.kind, 'live');
    assert.notEqual(empty.kind, 'offline');
    assert.equal(empty.trackedText, '0');
    assert.equal(empty.paint, false);
    assert.equal(
      formatTleSourceLabel({
        liveError: false,
        liveCatalogUnavailable: false,
        tleSource: 'supgp',
      }),
      'CelesTrak SupGP'
    );

    const stale = tleStripBadge({
      liveLoading: false,
      liveError: false,
      liveCatalog: catalog({
        count: 8000,
        tleOffline: true,
        observed_at: '2026-08-01T00:00:00.000Z',
      }),
    });
    assert.equal(stale.kind, 'stale_cache');
    assert.equal(stale.label, 'stale cache');
    assert.equal(stale.paint, true);
    assert.equal(stale.trackedText, '8,000');

    const replay = tleStripBadge({
      liveLoading: false,
      liveError: false,
      liveCatalog: catalog({
        count: 100,
        playbackDate: '2026-01-15',
        tleOffline: false,
      }),
      playbackDate: '2026-01-15',
    });
    assert.equal(replay.kind, 'replay');
    assert.equal(replay.label, 'replay');
    assert.match(replay.title, /reconstructed historical TLE/i);
    assert.doesNotMatch(replay.title, /\blive\b/i);
    assert.notEqual(replay.kind, 'live');

    const live = tleStripBadge({
      liveLoading: false,
      liveError: false,
      liveCatalog: catalog({
        count: 50,
        tleOffline: false,
        observed_at: '2026-08-27T12:00:00.000Z',
      }),
    });
    assert.equal(live.kind, 'live');
    assert.equal(live.label, 'live');
    assert.ok(catalogHasTlePoints(catalog({ count: 50 })));
    assert.ok(!catalogHasTlePoints(catalog({ count: 0 })));

    const keepPainting = tleStripBadge({
      liveLoading: true,
      liveError: true,
      liveCatalog: catalog({ count: 12, tleOffline: true, observed_at: '2026-08-01T00:00:00.000Z' }),
    });
    assert.equal(keepPainting.kind, 'stale_cache');
    assert.equal(keepPainting.paint, true);
    assert.notEqual(keepPainting.kind, 'syncing');
    assert.notEqual(keepPainting.kind, 'live');
  });

  it('orbitalOpsSubtitle is view-specific', () => {
    assert.match(orbitalOpsSubtitle('ops', true), /Walker/);
    assert.match(orbitalOpsSubtitle('manifest', false), /manifest/);
    assert.match(orbitalOpsSubtitle('cams', false), /pad feeds/);
    assert.match(orbitalOpsSubtitle('fleet', false), /fleet data/);
    assert.match(orbitalOpsSubtitle('global', false), /GCAT/);
    assert.match(orbitalOpsSubtitle('status', false), /operator status/);
    assert.match(orbitalOpsSubtitle('settings', false), /settings/);
    assert.match(orbitalOpsSubtitle('deorbit', false), /deorbit board/);
  });

  it('formatTleSourceLabel includes SupGP', () => {
    assert.equal(
      formatTleSourceLabel({
        liveError: false,
        liveCatalogUnavailable: false,
        tleSource: 'supgp',
      }),
      'CelesTrak SupGP'
    );
  });

  it('islEdgeDrawStride thins cross-plane links sooner', () => {
    assert.equal(islEdgeDrawStride(0, false), 1);
    assert.equal(islEdgeDrawStride(0, true), 1);
    assert.equal(islEdgeDrawStride(0.7, false), 1);
    assert.equal(islEdgeDrawStride(0.7, true), 2);
    assert.equal(islEdgeDrawStride(1.0, false), 2);
    assert.equal(islEdgeDrawStride(1.0, true), 3);
    assert.equal(islEdgeDrawStride(1.3, true), 4);
  });

  it('shouldDrawIslEdge respects stride', () => {
    assert.equal(shouldDrawIslEdge(0, true, 0.7), true);
    assert.equal(shouldDrawIslEdge(1, true, 0.7), false);
    assert.equal(shouldDrawIslEdge(2, true, 0.7), true);
  });

  it('viewMenuSummary lists active overlays and says off when none', () => {
    assert.equal(
      viewMenuSummary({
        autoSpin: true,
        showGhostGrid: false,
        showPlaneArcs: true,
        showCoverageCone: true,
      }),
      'auto-spin · arcs · coverage'
    );
    assert.equal(
      viewMenuSummary({
        autoSpin: false,
        showGhostGrid: false,
        showPlaneArcs: false,
        showCoverageCone: false,
      }),
      'off'
    );
  });
});
