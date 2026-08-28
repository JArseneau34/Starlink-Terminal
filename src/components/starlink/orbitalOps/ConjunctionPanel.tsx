import { useEffect, useMemo, useState } from 'react';
import type { SocratesConjunction, SocratesSnapshot } from '../../../api/conjunctionsClient';
import {
  formatMaxProb,
  formatMissKm,
  formatTcaCountdown,
} from '../../../utils/conjunctionFormat';
import {
  CONJUNCTION_MAX_EPOCH_DAYS,
  isConjunctionAgeOk,
} from '../../../utils/orbitalEpochAge';

interface ConjunctionPanelProps {
  snapshot: SocratesSnapshot | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
  showOverlay: boolean;
  onToggleOverlay: () => void;
}

function shortName(name: string): string {
  return name.replace(/\s*\[[^\]]*\]\s*$/, '');
}

function Row({
  c,
  selected,
  onSelect,
  nowMs,
}: {
  c: SocratesConjunction;
  selected: boolean;
  onSelect: () => void;
  nowMs: number;
}) {
  return (
    <button
      type="button"
      className={`conj-row${selected ? ' conj-row--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="conj-row-top">
        <span className="conj-row-tca tabular-nums">{formatTcaCountdown(c.tca, nowMs)}</span>
        <span className="conj-row-miss tabular-nums">{formatMissKm(c.miss_km)}</span>
      </div>
      <div className="conj-row-pair">
        {shortName(c.name_1)} · {shortName(c.name_2)}
      </div>
      <div className="conj-row-meta tabular-nums">
        {c.relative_speed_km_s.toFixed(1)} km/s
        {c.max_prob != null ? ` · Pmax ${formatMaxProb(c.max_prob)}` : ''}
      </div>
    </button>
  );
}

export function ConjunctionPanel({
  snapshot,
  loading,
  error,
  selectedId,
  onSelect,
  showOverlay,
  onToggleOverlay,
  onRefresh,
}: ConjunctionPanelProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { upcoming, suppressed } = useMemo(() => {
    const list = snapshot?.conjunctions ?? [];
    const t0 = nowMs - 5 * 60_000;
    const ageOk = list.filter((c) =>
      isConjunctionAgeOk({ dse_1: c.dse_1, dse_2: c.dse_2 })
    );
    const upcoming = ageOk
      .filter((c) => Date.parse(c.tca) >= t0)
      .sort((a, b) => a.tca.localeCompare(b.tca))
      .slice(0, 24);
    return {
      upcoming,
      suppressed: list.length - ageOk.length,
    };
  }, [snapshot, nowMs]);

  return (
    <div className="conj-panel">
      <div className="conj-panel-header">
        <div>
          <div className="conj-panel-title">Conjunctions</div>
          <div className="conj-panel-sub">SOCRATES · Starlink close approaches</div>
        </div>
        <div className="conj-panel-actions">
          <button
            type="button"
            className={`mesh-toggle${showOverlay ? ' mesh-toggle-on' : ''}`}
            onClick={onToggleOverlay}
            title="Draw miss-lines on the mesh"
          >
            overlay
          </button>
          <button type="button" className="mesh-toggle" onClick={onRefresh} disabled={loading}>
            refresh
          </button>
        </div>
      </div>

      {snapshot?.data_current_as_of ? (
        <div className="conj-panel-asof">as of {snapshot.data_current_as_of}</div>
      ) : null}
      {suppressed > 0 ? (
        <div
          className="conj-panel-suppressed"
          title={`SGP4 error grows ~1–3 km/day. Events with either TLE older than ${CONJUNCTION_MAX_EPOCH_DAYS}d are omitted — not shown as low-confidence.`}
        >
          {suppressed} hidden · TLE &gt;{CONJUNCTION_MAX_EPOCH_DAYS}d
        </div>
      ) : null}
      {error ? <div className="conj-panel-err">{error}</div> : null}
      {snapshot?.error ? <div className="conj-panel-err">{snapshot.error}</div> : null}
      {loading && !snapshot ? <div className="conj-panel-empty">Loading SOCRATES…</div> : null}

      <div className="conj-list">
        {upcoming.length === 0 && snapshot ? (
          <div className="conj-panel-empty">
            {suppressed > 0
              ? 'No age-valid Starlink conjunctions (stale TLEs suppressed).'
              : 'No upcoming Starlink conjunctions in feed.'}
          </div>
        ) : (
          upcoming.map((c) => (
            <Row
              key={c.id}
              c={c}
              selected={selectedId === c.id}
              nowMs={nowMs}
              onSelect={() => onSelect(selectedId === c.id ? null : c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
