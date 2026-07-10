import { useCallback, useEffect, useState } from 'react';
import {
  approveAllSatStatsReviews,
  approveSatStatsReview,
  downloadSatStatsCsvZip,
  fetchHistoricalBootstrapStatus,
  fetchSatStatsAssumptions,
  fetchSatStatsReviews,
  fetchSatStatsSnapshot,
  publishSatStatsSnapshot,
  rejectSatStatsReview,
  runHistoricalBootstrap,
  runSatStatsTrueUp,
  runSatStatsUpdate,
  saveModelAssumption,
} from '../api/satStatsClient';
import type { SatStatsModelAssumption, SatStatsReview, SatStatsSnapshot } from '../types/satStats';

export function useSatStatsDashboard(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<SatStatsSnapshot | null>(null);
  const [reviews, setReviews] = useState<SatStatsReview[]>([]);
  const [models, setModels] = useState<SatStatsModelAssumption[]>([]);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [launchCount, setLaunchCount] = useState(0);
  const [status, setStatus] = useState('Loading snapshot…');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [snap, rev, assumptions, boot] = await Promise.all([
        fetchSatStatsSnapshot(),
        fetchSatStatsReviews(),
        fetchSatStatsAssumptions(),
        fetchHistoricalBootstrapStatus(),
      ]);
      setSnapshot(snap);
      setReviews(rev);
      setModels(assumptions.models);
      setBootstrapDone(boot.done);
      setLaunchCount(boot.launch_archive_count);
      setStatus(`Snapshot #${snap.snapshot_id} · ${snap.created_at.slice(0, 19).replace('T', ' ')} UTC`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('No snapshot yet — run Update.');
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
    models,
    bootstrapDone,
    launchCount,
    status,
    busy,
    error,
    refresh: () => wrap('Refreshing…', async () => {}),
    runUpdate: () =>
      wrap('Running pipeline update…', async () => {
        const result = await runSatStatsUpdate();
        setStatus(
          `Update complete · run ${result.run_id} · snapshot ${result.snapshot_id ?? '—'} · ${result.pending_reviews} pending reviews`
        );
      }),
    runBootstrap: (force = false) =>
      wrap('Bootstrapping historical Wikipedia launches…', async () => {
        if (!force && bootstrapDone) return;
        if (
          force &&
          !window.confirm('Re-run historical Wikipedia bootstrap? This may queue many review items.')
        ) {
          return;
        }
        if (
          !force &&
          !window.confirm('Run one-time historical Wikipedia launch bootstrap?')
        ) {
          return;
        }
        await runHistoricalBootstrap(force);
      }),
    approveReview: (id: number) =>
      wrap(`Approving review #${id}…`, async () => {
        await approveSatStatsReview(id);
      }),
    rejectReview: (id: number) =>
      wrap(`Rejecting review #${id}…`, async () => {
        await rejectSatStatsReview(id);
      }),
    approveAll: () =>
      wrap('Approving all pending reviews…', async () => {
        const result = await approveAllSatStatsReviews();
        setStatus(`Approved ${result.approved_count} reviews`);
      }),
    runTrueUp: () =>
      wrap('Building seed true-up batch…', async () => {
        const result = await runSatStatsTrueUp();
        setStatus(
          `True-up queued · review #${result.review_id} · ${String(result.report.field_changes)} field changes · approve in queue`
        );
      }),
    saveModel: (model: SatStatsModelAssumption) =>
      wrap('Saving model assumption…', async () => {
        await saveModelAssumption(model);
      }),
    publishCsv: () =>
      wrap('Preparing CSV export…', async () => {
        if (!snapshot) throw new Error('No snapshot loaded');
        await downloadSatStatsCsvZip(snapshot.snapshot_id);
        setStatus(`Downloaded CSV bundle for snapshot #${snapshot.snapshot_id}`);
      }),
    publishApi: () =>
      wrap('Publishing snapshot…', async () => {
        if (!snapshot) throw new Error('No snapshot loaded');
        await publishSatStatsSnapshot(snapshot.snapshot_id);
        setStatus(`Published snapshot #${snapshot.snapshot_id} to static feeds`);
      }),
  };
}
