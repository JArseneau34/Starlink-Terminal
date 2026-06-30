import { useMemo } from 'react';
import type { StarlinkIntelPayload } from '../../types/orbital';
import { buildRevenueScenario, formatArrUsd } from '../../utils/starlinkRevenueScenario';

interface StarlinkRevenueScenarioPanelProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
}

function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const SCENARIO_ACCENT: Record<string, string> = {
  bear: '#ff4d5a',
  base: '#3de8ff',
  bull: '#2ee86a',
};

export function StarlinkRevenueScenarioPanel({ intel, isLoading }: StarlinkRevenueScenarioPanelProps) {
  const rev = useMemo(() => buildRevenueScenario(intel), [intel]);

  if (isLoading && !intel) {
    return (
      <div className="starlink-inv-block starlink-inv-block--revenue">
        <div className="mesh-overlay-label">Revenue Scenario</div>
        <div className="text-bbg-muted text-[10px] py-2">Loading revenue model…</div>
      </div>
    );
  }

  return (
    <div className="starlink-inv-block starlink-inv-block--revenue starlink-rev">
      <div className="starlink-rev-head">
        <div>
          <div className="mesh-overlay-label mb-0">Revenue Scenario</div>
          <p className="starlink-inv-block-desc">
            Network → ARR bridge · {formatMonth(rev.asOfMonth)} imputation
          </p>
        </div>
        <div className="starlink-rev-runrate" title="Base-case annualized revenue run-rate from current subscribers, ARPU and DTC assumptions.">
          <span>run-rate ARR</span>
          <b className="tabular-nums">{formatArrUsd(rev.baseArrUsd)}</b>
        </div>
      </div>

      <div className="starlink-rev-bridge">
        <div className="starlink-rev-bridge-step">
          <span>subscribers</span>
          <b className="tabular-nums">{rev.subscribersImputed.toLocaleString()}</b>
        </div>
        <span className="starlink-rev-bridge-op">×</span>
        <div className="starlink-rev-bridge-step">
          <span>blended ARPU</span>
          <b className="tabular-nums">~$105/mo</b>
        </div>
        <span className="starlink-rev-bridge-op">+</span>
        <div className="starlink-rev-bridge-step">
          <span>DTC layer</span>
          <b className="tabular-nums">{rev.dtcSatellites.toLocaleString()} sats</b>
        </div>
        <span className="starlink-rev-bridge-op">→</span>
        <div className="starlink-rev-bridge-step starlink-rev-bridge-step--out">
          <span>ARR</span>
          <b className="tabular-nums text-bbg-cyan">{formatArrUsd(rev.baseArrUsd)}</b>
        </div>
      </div>

      <div className="starlink-rev-scenarios">
        <div className="starlink-inv-list-label starlink-rev-scenarios-label">12-month forward ARR</div>
        <div className="starlink-rev-scenarios-grid">
        {rev.scenarios.map((s) => (
          <div
            key={s.key}
            className={`starlink-rev-scenario starlink-rev-scenario--${s.key}`}
            style={{ '--rev-accent': SCENARIO_ACCENT[s.key] } as React.CSSProperties}
            title={s.growthNote}
          >
            <div className="starlink-rev-scenario-label">{s.label}</div>
            <div className="starlink-rev-scenario-arr tabular-nums">{formatArrUsd(s.arrUsd)}</div>
            <div className="starlink-rev-scenario-sub tabular-nums">
              {s.subscriberTarget.toLocaleString()} subs · ${s.monthlyArpu}/mo
            </div>
          </div>
        ))}
        </div>
      </div>

      <div className="starlink-rev-streams">
        {rev.streams.map((stream) => (
          <div key={stream.key} className="starlink-rev-stream" title={stream.driver}>
            <div className="starlink-rev-stream-head">
              <span>{stream.label}</span>
              <b className="tabular-nums">{formatArrUsd(stream.arrUsd)}</b>
            </div>
            <div className="starlink-rev-stream-track">
              <i style={{ width: `${Math.max(3, stream.share * 100)}%` }} />
            </div>
            <div className="starlink-rev-stream-meta">
              <span>{stream.driver}</span>
              <span className="starlink-inv-badge starlink-inv-badge--estimate">estimate</span>
            </div>
          </div>
        ))}
      </div>

      {rev.subscriberYoYGrowthPct != null && (
        <p className="starlink-inv-footnote">
          Subscriber imputation grew{' '}
          <b className="text-bbg-white">+{rev.subscriberYoYGrowthPct.toFixed(0)}% YoY</b> while
          capacity reached{' '}
          <b className="text-bbg-white">{rev.bandwidthTbps.toFixed(1)} Tbps</b> — the revenue story
          is scaling with the network, not just satellite count.
        </p>
      )}
    </div>
  );
}
