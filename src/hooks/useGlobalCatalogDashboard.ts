import { useCallback, useEffect, useState } from 'react';
import {
  approveAllGlobalReviews,
  approveGlobalReview,
  downloadGlobalCatalogCsvZip,
  fetchGlobalBootstrapStatus,
  fetchGlobalCatalogReviews,
  fetchGlobalCatalogSnapshot,
  publishGlobalCatalogApi,
  rejectGlobalReview,
  runGlobalBootstrap,
  runGlobalCatalogUpdate,
} from '../api/globalCatalogClient';
import type { GlobalCatalogReview, GlobalCatalogSnapshot } from '../types/globalCatalog';

export function useGlobalCatalogDashboard(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<GlobalCatalogSnapshot | null>(null);
  const [reviews, setReviews] = useState<GlobalCatalogReview[]>([]);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [launchCount, setLaunchCount] = useState(0);
  const [satelliteCount, setSatelliteCount] = useState(0);
  const [status, setStatus] = useState('Loading global snapshot…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [snap, rev, boot] = await Promise.all([
        fetchGlobalCatalogSnapshot(),
        fetchGlobalCatalogReviews(),
        fetchGlobalBootstrapStatus(),
      ]);
      setSnapshot(snap);
      setReviews(rev);
      setBootstrapDone(boot.done);
      setLaunchCount(boot.global_launches_count);
      setSatelliteCount(boot.global_satellites_count);
      setStatus(`Global snapshot #${snap.snapshot_id} · ${snap.created_at.slice(0, 19).replace('T', ' ')} UTC`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('No global snapshot yet — bootstrap GCAT or run Update Global.');
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const wrap = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return {
    snapshot,
    reviews,
    bootstrapDone,
    launchCount,
    satelliteCount,
    status,
    busy,
    error,
    refresh: () => wrap('Refreshing…', async () => {}),
    runUpdate: () =>
      wrap('Running global GCAT update…', async () => {
        const result = await runGlobalCatalogUpdate();
        setStatus(
          `Update complete · run ${result.run_id} · snapshot ${result.snapshot_id ?? '—'} · ${result.pending_reviews} pending reviews`
        );
      }),
    runBootstrap: (force = false) =>
      wrap('Bootstrapping GCAT catalog…', async () => {
        if (
          !force &&
          !window.confirm(
            'Download GCAT launch.tsv + satcat.tsv (~10 MB) and populate global tables? Takes ~1 minute.'
          )
        ) {
          return;
        }
        if (
          force &&
          !window.confirm('Force re-bootstrap GCAT? This may overwrite global table state.')
        ) {
          return;
        }
        await runGlobalBootstrap(force);
      }),
    approveReview: (id: number) =>
      wrap(`Approving global review #${id}…`, async () => {
        await approveGlobalReview(id);
      }),
    rejectReview: (id: number) =>
      wrap(`Rejecting global review #${id}…`, async () => {
        await rejectGlobalReview(id);
      }),
    approveAll: () =>
      wrap('Approving all pending global reviews…', async () => {
        if (!window.confirm('Approve every open global review (pending and needs-assumption rows)?')) {
          return;
        }
        const result = await approveAllGlobalReviews();
        setStatus(`Approved ${result.approved_count} global review(s)`);
      }),
    publishCsv: () =>
      wrap('Preparing global CSV export…', async () => {
        await downloadGlobalCatalogCsvZip();
        setStatus('Downloaded global catalogue CSV bundle');
      }),
    publishApi: () =>
      wrap('Publishing global snapshot to API…', async () => {
        const endpoint = window.prompt('Enter platform API endpoint URL:');
        if (!endpoint?.trim()) {
          setStatus('Publish canceled.');
          return;
        }
        const result = (await publishGlobalCatalogApi(endpoint.trim())) as {
          snapshot_id?: number;
          details?: { http_status?: number };
        };
        setStatus(
          `Publish (API) succeeded for snapshot ${result.snapshot_id ?? '—'} (HTTP ${result.details?.http_status ?? '—'})`
        );
      }),
  };
}
