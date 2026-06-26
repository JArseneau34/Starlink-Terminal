import { useMemo } from 'react';
import type { Launch } from '../../types';
import type { StarlinkIntelPayload } from '../../types/orbital';
import {
  formatAgeHours,
  kpRiskLevel,
  LEO_BROADBAND_COMPETITORS,
  STARLINK_BUSINESS_KPIS,
  STARLINK_INVESTOR_MILESTONES,
  launchCadenceMetrics,
  operationalProxies,
  shellFillStats,
  sourceBadge,
  sourceBadgeClass,
} from '../../data/starlinkInvestor';
import { STARLINK_SHELLS, shellHex } from './starlinkCatalog';

interface StarlinkInvestorPanelProps {
  launches: Launch[];
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
  spaceWeatherKp?: number | null;
}

function Kpi({
  label,
  value,
  hint,
  sub,
  source,
}: {
  label: string;
  value: string;
  hint?: string;
  sub?: string;
  source?: 'live' | 'reported' | 'estimate';
}) {
  return (
    <div className="starlink-inv-kpi" title={hint}>
      <div className="starlink-inv-kpi-head">
        <span className="starlink-inv-kpi-label">{label}</span>
        {source && (
          <span className={`starlink-inv-badge ${sourceBadgeClass(source)}`}>
            {sourceBadge(source)}
          </span>
        )}
      </div>
      <div className="starlink-inv-kpi-value">{value}</div>
      {sub && <div className="starlink-inv-kpi-sub">{sub}</div>}
    </div>
  );
}

function lifecyclePct(intel: StarlinkIntelPayload, key: keyof StarlinkIntelPayload['lifecycle']): number {
  const total = intel.totalTracked || 1;
  return (intel.lifecycle[key] / total) * 100;
}

function formatLaunchDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export function StarlinkInvestorPanel({
  launches,
  intel,
  isLoading,
  spaceWeatherKp,
}: StarlinkInvestorPanelProps) {
  const cadence = useMemo(() => launchCadenceMetrics(launches), [launches]);
  const shells = useMemo(() => (intel ? shellFillStats(intel) : []), [intel]);
  const ops = useMemo(() => (intel ? operationalProxies(intel) : null), [intel]);
  const kp = useMemo(() => kpRiskLevel(spaceWeatherKp), [spaceWeatherKp]);

  const competitors = useMemo(() => {
    return LEO_BROADBAND_COMPETITORS.map((row) => {
      const liveFleet =
        row.operator === 'Starlink'
          ? (intel?.totalTracked ?? null)
          : row.fleetBaseline;
      return {
        ...row,
        fleetDisplay: liveFleet,
        lastLaunch:
          row.operator === 'Starlink' && cadence.lastLaunch
            ? formatLaunchDate(cadence.lastLaunch.date)
            : row.lastLaunch,
      };
    });
  }, [intel?.totalTracked, cadence.lastLaunch]);

  const maxPeerFleet = useMemo(() => {
    const counts = competitors.map((c) => c.fleetDisplay ?? 0);
    return Math.max(...counts, 1);
  }, [competitors]);

  const raiseDecay = intel ? intel.lifecycle.raising + intel.lifecycle.deorbiting : 0;

  return (
    <div className="starlink-investor-view flex-1 min-h-0 overflow-hidden panel-surface">
      <header className="starlink-investor-header">
        <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gradient-accent">
          Starlink Investor
        </div>
        <div className="text-[9px] text-bbg-muted tracking-wider mt-0.5">
          Business KPIs · live constellation · launch cadence · competitive scale
        </div>
      </header>

      <div className="starlink-investor-dashboard">
        <section className="starlink-inv-block starlink-inv-block--kpis">
          <div className="mesh-overlay-label">Business KPIs</div>
          <p className="starlink-inv-block-desc">
            Subscribers, markets, direct-to-cell, and revenue run-rate — labeled by source.
          </p>
          <div className="starlink-inv-kpi-row">
            {STARLINK_BUSINESS_KPIS.map((kpi) => (
              <Kpi
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                sub={[kpi.sub, kpi.asOf ? `As of ${kpi.asOf}` : ''].filter(Boolean).join(' · ')}
                source={kpi.source}
              />
            ))}
          </div>
        </section>

        <section className="starlink-inv-block starlink-inv-block--fleet">
          <div className="mesh-overlay-label">Constellation · Live NORAD</div>
          {isLoading && !intel ? (
            <div className="text-bbg-muted text-[10px] py-2">Loading fleet intel…</div>
          ) : intel ? (
            <>
              <div className="starlink-inv-kpi-grid">
                <Kpi label="Tracked" value={intel.totalTracked.toLocaleString()} source="live" />
                <Kpi label="Launched YTD" value={intel.launchedYtd.toLocaleString()} source="live" />
                <Kpi label="Operational" value={`${ops?.operationalPct ?? 0}%`} source="live" />
                <Kpi
                  label="Raise / decay"
                  value={raiseDecay.toLocaleString()}
                  hint={`${intel.lifecycle.raising} raising · ${intel.lifecycle.deorbiting} deorbiting`}
                  source="live"
                />
                <Kpi
                  label="Ephemerides"
                  value={`${ops?.ephemerisCoveragePct ?? 0}%`}
                  hint={`${intel.ephemerisPublished.toLocaleString()} of ${intel.totalTracked.toLocaleString()} with SpaceX ephemerides`}
                  source="live"
                />
                <Kpi
                  label="TLE freshness"
                  value={formatAgeHours(intel.medianEpochAgeHours)}
                  hint={`${intel.staleTleCount.toLocaleString()} stale >7d · median epoch age`}
                  source="live"
                />
              </div>

              <div className="starlink-lifecycle-bar starlink-inv-lifecycle-bar">
                <div
                  className="starlink-lifecycle-seg starlink-lifecycle-seg--operational"
                  style={{ width: `${lifecyclePct(intel, 'operational')}%` }}
                />
                <div
                  className="starlink-lifecycle-seg starlink-lifecycle-seg--raising"
                  style={{ width: `${lifecyclePct(intel, 'raising')}%` }}
                />
                <div
                  className="starlink-lifecycle-seg starlink-lifecycle-seg--deorbiting"
                  style={{ width: `${lifecyclePct(intel, 'deorbiting')}%` }}
                />
                <div
                  className="starlink-lifecycle-seg starlink-lifecycle-seg--other"
                  style={{ width: `${lifecyclePct(intel, 'other')}%` }}
                />
              </div>
              <div className="starlink-lifecycle-legend starlink-inv-lifecycle-legend">
                <span>
                  <i className="starlink-lifecycle-dot starlink-lifecycle-dot--operational" />
                  {intel.lifecycle.operational.toLocaleString()} operational
                </span>
                <span>
                  <i className="starlink-lifecycle-dot starlink-lifecycle-dot--raising" />
                  {intel.lifecycle.raising.toLocaleString()} raising
                </span>
                <span>
                  <i className="starlink-lifecycle-dot starlink-lifecycle-dot--deorbiting" />
                  {intel.lifecycle.deorbiting.toLocaleString()} decay
                </span>
              </div>

              <div className="mesh-overlay-label starlink-inv-subhead">Shell distribution</div>
              <div className="starlink-inv-shells">
                {shells.map((sh) => {
                  const shellDef = STARLINK_SHELLS.find((s) => s.name === sh.name);
                  const hex = shellDef ? shellHex(shellDef.color) : '#3de8ff';
                  return (
                    <div key={sh.name} className="starlink-inv-shell">
                      <span className="mesh-legend-dot" style={{ color: hex, background: hex }} />
                      <span className="starlink-inv-shell-name">{sh.name}°</span>
                      <div className="starlink-inv-shell-track">
                        <div
                          className="starlink-inv-shell-fill"
                          style={{ width: `${Math.max(4, sh.fleetSharePct)}%`, background: hex }}
                        />
                      </div>
                      <span className="starlink-inv-shell-val tabular-nums">
                        {sh.count.toLocaleString()}
                        <span className="starlink-inv-shell-pct">{sh.fleetSharePct}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-bbg-muted text-[10px] py-2">Fleet intel unavailable</div>
          )}
        </section>

        <section className="starlink-inv-block starlink-inv-block--cadence">
          <div className="mesh-overlay-label">Launch Supply · Cadence</div>
          <p className="starlink-inv-block-desc">From your SpaceX launch feed · Starlink missions only.</p>
          <div className="starlink-inv-kpi-grid">
            <Kpi
              label="Starlink YTD"
              value={String(cadence.ytd)}
              hint={`${cadence.starlinkShareYtd ?? 0}% of SpaceX YTD (${cadence.spacexYtd})`}
              source="live"
            />
            <Kpi label="Last 90 days" value={String(cadence.last90)} source="live" />
            <Kpi
              label="Days since last"
              value={cadence.daysSinceLast != null ? `${cadence.daysSinceLast}d` : '—'}
              hint={
                cadence.lastLaunch
                  ? `${cadence.lastLaunch.name} · ${formatLaunchDate(cadence.lastLaunch.date)}`
                  : undefined
              }
              source="live"
            />
            <Kpi
              label="Avg gap"
              value={cadence.avgDaysBetween != null ? `${cadence.avgDaysBetween}d` : '—'}
              hint="Mean interval · last 12 launches"
              source="live"
            />
          </div>
          {cadence.upcoming.length > 0 ? (
            <div className="starlink-inv-list-block">
              <div className="starlink-inv-list-label">Upcoming missions</div>
              <ul className="starlink-inv-list">
                {cadence.upcoming.map((launch) => (
                  <li key={launch.id} className="starlink-inv-list-row">
                    <span className="starlink-inv-list-primary truncate" title={launch.name}>
                      {launch.name}
                    </span>
                    <span className="starlink-inv-list-meta tabular-nums">
                      {formatLaunchDate(launch.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="starlink-inv-footnote">No upcoming Starlink missions in launch feed.</p>
          )}
        </section>

        <section className="starlink-inv-block starlink-inv-block--peers">
          <div className="mesh-overlay-label">LEO Broadband · Competitive Scale</div>
          <p className="starlink-inv-block-desc">Starlink live NORAD vs peer baselines.</p>
          <div className="starlink-inv-peers">
            {competitors.map((row) => {
              const fleet = row.fleetDisplay ?? 0;
              const pct = Math.max(2, Math.round((fleet / maxPeerFleet) * 100));
              const isLive = row.operator === 'Starlink' && intel != null;
              return (
                <div key={row.operator} className="starlink-inv-peer" title={row.note}>
                  <div className="starlink-inv-peer-head">
                    <span className="starlink-inv-peer-name">{row.operator}</span>
                    <span className="starlink-inv-peer-fleet tabular-nums">
                      {fleet > 0 ? fleet.toLocaleString() : '—'}
                      {isLive && <span className="starlink-inv-peer-live"> LIVE</span>}
                    </span>
                  </div>
                  <div className="starlink-inv-peer-track">
                    <div
                      className={`starlink-inv-peer-fill${row.operator === 'Starlink' ? ' starlink-inv-peer-fill--starlink' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="starlink-inv-peer-meta">
                    <span>Target {row.targetFleet}</span>
                    <span className="tabular-nums">Last {row.lastLaunch}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="starlink-inv-block starlink-inv-block--risk">
          <div className="mesh-overlay-label">Ops Risk Monitors</div>
          <div className="starlink-inv-kpi-grid starlink-inv-kpi-grid--3">
            <Kpi
              label="Geomagnetic Kp"
              value={spaceWeatherKp != null ? spaceWeatherKp.toFixed(1) : '—'}
              sub={kp.label}
              source="live"
            />
            <Kpi
              label="Raising pipeline"
              value={intel ? String(intel.lifecycle.raising) : '—'}
              hint="Satellites still raising orbit"
              source="live"
            />
            <Kpi
              label="Recent batches"
              value={String(intel?.recentLaunches.length ?? 0)}
              hint="Launch groups in last intel window"
              source="live"
            />
          </div>
          <div
            className={`starlink-inv-kp-pill starlink-inv-kp-pill--${kp.tone}`}
            aria-label={`Kp risk: ${kp.label}`}
          >
            Kp {spaceWeatherKp != null ? spaceWeatherKp.toFixed(1) : '—'} · {kp.label}
          </div>
          {intel && intel.recentLaunches.length > 0 && (
            <div className="starlink-inv-list-block">
              <div className="starlink-inv-list-label">Recent launch batches</div>
              <ul className="starlink-inv-list">
                {intel.recentLaunches.slice(0, 4).map((batch) => (
                  <li key={batch.intlDesignator} className="starlink-inv-list-row">
                    <span className="starlink-inv-list-primary tabular-nums">{batch.intlDesignator}</span>
                    <span className="starlink-inv-list-meta tabular-nums">
                      {batch.satelliteCount} sats · {batch.dominantShell}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="starlink-inv-block starlink-inv-block--milestones">
          <div className="mesh-overlay-label">Milestones</div>
          <p className="starlink-inv-block-desc">Curated product & market events.</p>
          <div className="starlink-inv-milestones">
            {STARLINK_INVESTOR_MILESTONES.map((m) => (
              <article key={`${m.date}-${m.event}`} className="starlink-inv-milestone">
                <time className="starlink-inv-ms-date tabular-nums">{m.date}</time>
                <h4 className="starlink-inv-ms-event">{m.event}</h4>
                <p className="starlink-inv-ms-detail">{m.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
