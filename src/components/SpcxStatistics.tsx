import { useMemo, useState } from 'react';
import type { Launch, StockQuote } from '../types';
import { Panel } from './Panel';
import { SubTabs } from './SubTabs';
import { LaunchCalendar } from './LaunchCalendar';
import { SpcxEquityChart } from './SpcxEquityChart';
import {
  SPCX_IPO,
  SPCX_OPERATIONAL_STATS,
  SPCX_MILESTONES,
  filterSpaceXLaunches,
} from '../data/spcxStats';
import {
  SPCX_CAPITAL_STRUCTURE,
  SPCX_EQUITY_KPIS,
  SPCX_EQUITY_RISKS,
  SPCX_FACILITIES,
  SPCX_GROWTH_DRIVERS,
  SPCX_OPS_PROGRAMS,
  SPCX_PEER_EQUITY,
  SPCX_REVENUE_SEGMENTS,
  SPCX_REUSABILITY_STATS,
  buildLaunchOpsKpis,
  buildConstellationOpsKpis,
  impliedStarlinkValue,
  spacexLaunchMetrics,
  spcxMetricBadge,
  spcxMetricBadgeClass,
  type SpcxInvestorKpi,
  type SpcxMetricSource,
} from '../data/spcxInvestor';
import { STARLINK_BUSINESS_KPIS } from '../data/starlinkInvestor';
import { getCompanyBySymbol } from '../data/companies';
import { useStarlinkIntelData } from '../hooks/useStarlinkIntelData';
import {
  formatPrice,
  formatVolume,
  formatMarketCap,
  getChangeColor,
} from '../utils/format';

export type SpcxSubTab = 'equity' | 'operations' | 'milestones' | 'launches';

interface SpcxStatisticsProps {
  quote?: StockQuote;
  launches: Launch[];
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="text-bbg-white text-sm font-semibold mt-1">{value}</div>
      {sub && <div className="text-bbg-muted text-[9px] mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function InvKpi({ label, value, sub, source }: SpcxInvestorKpi) {
  return (
    <div className="spcx-inv-kpi">
      <div className="spcx-inv-kpi-head">
        <span className="spcx-inv-kpi-label">{label}</span>
        <span className={`spcx-inv-badge ${spcxMetricBadgeClass(source)}`}>
          {spcxMetricBadge(source)}
        </span>
      </div>
      <div className="spcx-inv-kpi-value">{value}</div>
      {sub && <div className="spcx-inv-kpi-sub">{sub}</div>}
    </div>
  );
}

function KpiGrid({ items }: { items: SpcxInvestorKpi[] }) {
  return (
    <div className="spcx-inv-kpi-grid">
      {items.map((kpi) => (
        <InvKpi key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

function BulletList({ items }: { items: { title: string; detail: string }[] }) {
  return (
    <ul className="spcx-inv-bullets">
      {items.map((item) => (
        <li key={item.title} className="spcx-inv-bullet">
          <span className="spcx-inv-bullet-title">{item.title}</span>
          <span className="spcx-inv-bullet-detail">{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function vehicleStatusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'text-bbg-green';
  if (s === 'TEST') return 'text-bbg-amber';
  if (s === 'DEPLOYING' || s === 'RAMPING') return 'text-bbg-cyan';
  return 'text-bbg-gray';
}

function formatLaunchDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export function SpcxStatistics({ quote, launches }: SpcxStatisticsProps) {
  const [activeSubTab, setActiveSubTab] = useState<SpcxSubTab>('equity');
  const company = getCompanyBySymbol('SPCX');
  const spacexLaunches = useMemo(() => filterSpaceXLaunches(launches), [launches]);
  const launchMetrics = useMemo(() => spacexLaunchMetrics(launches), [launches]);
  const { data: starlinkIntel, isLoading: intelLoading } = useStarlinkIntelData(
    activeSubTab === 'equity' || activeSubTab === 'operations'
  );

  const launchOpsKpis = useMemo(() => buildLaunchOpsKpis(launchMetrics), [launchMetrics]);
  const constellationOpsKpis = useMemo(
    () => (starlinkIntel ? buildConstellationOpsKpis(starlinkIntel) : []),
    [starlinkIntel]
  );

  const ipoGain = quote
    ? ((quote.price - SPCX_IPO.price) / SPCX_IPO.price) * 100
    : null;

  const starlinkImplied = impliedStarlinkValue(quote?.marketCap);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SubTabs<SpcxSubTab>
        active={activeSubTab}
        onChange={setActiveSubTab}
        tabs={[
          { id: 'equity', label: 'EQUITY' },
          { id: 'operations', label: 'OPERATIONS' },
          { id: 'milestones', label: 'MILESTONES', count: SPCX_MILESTONES.length },
          { id: 'launches', label: 'LAUNCHES', count: spacexLaunches.length },
        ]}
        headerRight={
          quote ? (
            <span className="text-bbg-amber text-[9px] tabular-nums tracking-wider">
              SPCX ${formatPrice(quote.price)}
            </span>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0 p-px terminal-grid">
        {activeSubTab === 'equity' && (
          <Panel title="SPCX — Equity & Business" flex={1} className="flex-1 min-h-0">
            <div className="spcx-investor-scroll">
              <div className="spcx-equity-header">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-bbg-amber font-bold text-lg">SPCX</span>
                    <span className="text-[10px] text-bbg-green border border-bbg-green/50 px-1 py-0.5">
                      IPO {SPCX_IPO.date}
                    </span>
                    <span className="text-[10px] text-bbg-cyan border border-bbg-cyan/50 px-1 py-0.5">
                      {SPCX_IPO.exchange}
                    </span>
                  </div>
                  <h2 className="text-bbg-white text-sm font-medium">
                    {company?.name ?? 'Space Exploration Technologies'}
                  </h2>
                  <p className="text-bbg-gray text-[10px] mt-0.5">
                    Launch · Starlink · Starshield · Starship
                  </p>
                </div>
                <div className="text-right">
                  {quote ? (
                    <>
                      <div className="text-bbg-white text-xl font-bold">${formatPrice(quote.price)}</div>
                      <div className={`text-sm ${getChangeColor(quote.change)}`}>
                        {quote.change >= 0 ? '+' : ''}
                        {quote.change.toFixed(2)} ({quote.changePercent >= 0 ? '+' : ''}
                        {quote.changePercent.toFixed(2)}%)
                      </div>
                      {ipoGain !== null && (
                        <div className={`text-[10px] mt-0.5 ${getChangeColor(ipoGain)}`}>
                          vs IPO {ipoGain >= 0 ? '+' : ''}
                          {ipoGain.toFixed(1)}%
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-bbg-gray text-[11px]">Loading quote…</div>
                  )}
                </div>
              </div>

              <SpcxEquityChart quote={quote} />

              <div className="spcx-investor-dashboard spcx-investor-dashboard--equity">
                <section className="spcx-inv-block spcx-inv-block--market">
                  <div className="mesh-overlay-label">Market Snapshot</div>
                  <div className="spcx-inv-kpi-grid">
                    <StatCard label="IPO PRICE" value={`$${SPCX_IPO.price.toFixed(2)}`} sub="Jun 12, 2026" />
                    <StatCard label="DAY 1 CLOSE" value={`$${SPCX_IPO.day1Close.toFixed(2)}`} sub="+19.4%" />
                    <StatCard label="WK1 GAIN" value={`+${SPCX_IPO.week1Gain}%`} sub="Post-IPO" />
                    {quote && (
                      <>
                        <StatCard label="VOLUME" value={formatVolume(quote.volume)} sub="Today" />
                        <StatCard label="OPEN" value={`$${formatPrice(quote.open)}`} />
                        <StatCard
                          label="DAY RANGE"
                          value={`$${formatPrice(quote.low)} – $${formatPrice(quote.high)}`}
                        />
                        {quote.marketCap && (
                          <StatCard
                            label="MARKET CAP"
                            value={formatMarketCap(quote.marketCap)}
                            sub="Public equity"
                          />
                        )}
                        {starlinkImplied && (
                          <StatCard
                            label="IMPL. STARLINK"
                            value={starlinkImplied}
                            sub="~78% of mkt cap · EST."
                          />
                        )}
                      </>
                    )}
                    <StatCard
                      label="SHARES OFFERED"
                      value={SPCX_IPO.sharesOffered}
                      sub={`Proceeds ${SPCX_IPO.proceeds}`}
                    />
                  </div>
                </section>

                <section className="spcx-inv-block spcx-inv-block--segments">
                  <div className="mesh-overlay-label">Revenue Mix · FY26E</div>
                  <p className="spcx-inv-desc">Segment-weighted estimates — not company reported.</p>
                  <div className="spcx-inv-segments">
                    {SPCX_REVENUE_SEGMENTS.map((seg) => (
                      <div key={seg.name} className="spcx-inv-segment">
                        <div className="spcx-inv-segment-head">
                          <span>{seg.name}</span>
                          <span className="tabular-nums">
                            {seg.revenueEst} · {seg.sharePct}%
                          </span>
                        </div>
                        <div className="spcx-inv-segment-track">
                          <div
                            className="spcx-inv-segment-fill"
                            style={{ width: `${seg.sharePct}%` }}
                          />
                        </div>
                        <div className="spcx-inv-segment-note">{seg.note}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="spcx-inv-block spcx-inv-block--business">
                  <div className="mesh-overlay-label">Business KPIs · Starlink</div>
                  <KpiGrid
                    items={STARLINK_BUSINESS_KPIS.map((k) => ({
                      label: k.label,
                      value: k.value,
                      sub: [k.sub, k.asOf ? `As of ${k.asOf}` : ''].filter(Boolean).join(' · '),
                      source: k.source as SpcxMetricSource,
                    }))}
                  />
                </section>

                <section className="spcx-inv-block spcx-inv-block--financials">
                  <div className="mesh-overlay-label">Financial Framework</div>
                  <KpiGrid items={SPCX_EQUITY_KPIS} />
                </section>

                <section className="spcx-inv-block spcx-inv-block--capital">
                  <div className="mesh-overlay-label">IPO & Capital Structure</div>
                  <div className="spcx-inv-kv-list">
                    <div className="spcx-inv-kv">
                      <span>IPO proceeds</span>
                      <b>{SPCX_CAPITAL_STRUCTURE.ipoProceeds}</b>
                    </div>
                    <div className="spcx-inv-kv">
                      <span>Float</span>
                      <b>{SPCX_CAPITAL_STRUCTURE.floatPct}</b>
                    </div>
                    <div className="spcx-inv-kv">
                      <span>Insider lockup</span>
                      <b>{SPCX_CAPITAL_STRUCTURE.insiderLockup}</b>
                    </div>
                    <div className="spcx-inv-kv">
                      <span>Primary use</span>
                      <b>{SPCX_CAPITAL_STRUCTURE.primaryUse}</b>
                    </div>
                    <div className="spcx-inv-kv">
                      <span>Net debt</span>
                      <b>{SPCX_CAPITAL_STRUCTURE.netDebt}</b>
                    </div>
                    <div className="spcx-inv-kv">
                      <span>Credit profile</span>
                      <b>{SPCX_CAPITAL_STRUCTURE.creditProfile}</b>
                    </div>
                  </div>
                </section>

                <section className="spcx-inv-block spcx-inv-block--peers">
                  <div className="mesh-overlay-label">Peer Comparables</div>
                  <table className="spcx-inv-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Company</th>
                        <th className="text-right">Mkt cap</th>
                        <th className="text-right">EV/Rev</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="spcx-inv-table-highlight">
                        <td className="text-bbg-amber">SPCX</td>
                        <td>SpaceX</td>
                        <td className="text-right tabular-nums">
                          {quote?.marketCap ? formatMarketCap(quote.marketCap) : '—'}
                        </td>
                        <td className="text-right tabular-nums">~12×</td>
                      </tr>
                      {SPCX_PEER_EQUITY.map((row) => (
                        <tr key={row.symbol}>
                          <td className="text-bbg-cyan">{row.symbol}</td>
                          <td>{row.name}</td>
                          <td className="text-right tabular-nums">{row.marketCap}</td>
                          <td className="text-right tabular-nums">{row.evRevenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="spcx-inv-block spcx-inv-block--drivers">
                  <div className="mesh-overlay-label">Growth Drivers</div>
                  <BulletList items={SPCX_GROWTH_DRIVERS} />
                </section>

                <section className="spcx-inv-block spcx-inv-block--risks">
                  <div className="mesh-overlay-label">Key Risks</div>
                  <BulletList items={SPCX_EQUITY_RISKS} />
                </section>
              </div>
            </div>
          </Panel>
        )}

        {activeSubTab === 'operations' && (
          <Panel title="Operations — Launch & Constellation" flex={1} className="flex-1 min-h-0">
            <div className="spcx-investor-scroll">
              <div className="spcx-investor-dashboard spcx-investor-dashboard--ops">
                <section className="spcx-inv-block spcx-inv-block--live">
                  <div className="mesh-overlay-label">Live Launch Cadence</div>
                  <p className="spcx-inv-desc">From your SpaceX launch feed · refreshes with terminal data.</p>
                  <KpiGrid items={launchOpsKpis} />
                </section>

                <section className="spcx-inv-block spcx-inv-block--constellation">
                  <div className="mesh-overlay-label">Constellation · Live NORAD</div>
                  {intelLoading && !starlinkIntel ? (
                    <p className="spcx-inv-desc">Loading fleet intel…</p>
                  ) : starlinkIntel ? (
                    <>
                      <KpiGrid items={constellationOpsKpis} />
                      {starlinkIntel.recentLaunches.length > 0 && (
                        <div className="spcx-inv-list-block">
                          <div className="spcx-inv-list-label">Recent launch batches</div>
                          <ul className="spcx-inv-list">
                            {starlinkIntel.recentLaunches.slice(0, 5).map((batch) => (
                              <li key={batch.intlDesignator} className="spcx-inv-list-row">
                                <span className="spcx-inv-list-primary tabular-nums">
                                  {batch.intlDesignator}
                                </span>
                                <span className="spcx-inv-list-meta tabular-nums">
                                  {batch.satelliteCount} sats · {batch.dominantShell}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <KpiGrid items={SPCX_OPERATIONAL_STATS.slice(0, 4).map((s) => ({
                      label: s.label,
                      value: s.value,
                      sub: s.sub,
                      source: 'reported' as SpcxMetricSource,
                    }))} />
                  )}
                </section>

                <section className="spcx-inv-block spcx-inv-block--programs">
                  <div className="mesh-overlay-label">Programs & Vehicles</div>
                  <table className="spcx-inv-table">
                    <thead>
                      <tr>
                        <th>Program</th>
                        <th>Status</th>
                        <th>Metric</th>
                        <th className="hidden md:table-cell">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SPCX_OPS_PROGRAMS.map((row) => (
                        <tr key={row.program}>
                          <td className="text-bbg-white">{row.program}</td>
                          <td className={vehicleStatusColor(row.status)}>{row.status}</td>
                          <td className="text-bbg-cyan tabular-nums">{row.metric}</td>
                          <td className="text-bbg-gray hidden md:table-cell">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="spcx-inv-block spcx-inv-block--reusability">
                  <div className="mesh-overlay-label">Reusability & Unit Economics</div>
                  <KpiGrid items={SPCX_REUSABILITY_STATS} />
                </section>

                <section className="spcx-inv-block spcx-inv-block--upcoming">
                  <div className="mesh-overlay-label">Upcoming Manifest</div>
                  {launchMetrics.upcoming.length > 0 ? (
                    <ul className="spcx-inv-list">
                      {launchMetrics.upcoming.map((launch) => (
                        <li key={launch.id} className="spcx-inv-list-row">
                          <span className="spcx-inv-list-primary truncate" title={launch.name}>
                            {launch.name}
                          </span>
                          <span className="spcx-inv-list-meta tabular-nums">
                            {formatLaunchDate(launch.date)} · {launch.rocket}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="spcx-inv-desc">No upcoming SpaceX missions in launch feed.</p>
                  )}
                </section>

                <section className="spcx-inv-block spcx-inv-block--facilities">
                  <div className="mesh-overlay-label">Sites & Operations</div>
                  <BulletList items={SPCX_FACILITIES} />
                  <div className="spcx-inv-kv spcx-inv-kv--inline mt-2">
                    <span>Headcount</span>
                    <b>13,000+</b>
                  </div>
                </section>

                <section className="spcx-inv-block spcx-inv-block--static-ops">
                  <div className="mesh-overlay-label">Reported Benchmarks</div>
                  <KpiGrid
                    items={SPCX_OPERATIONAL_STATS.map((s) => ({
                      label: s.label,
                      value: s.value,
                      sub: s.sub,
                      source: 'reported' as SpcxMetricSource,
                    }))}
                  />
                </section>
              </div>
            </div>
          </Panel>
        )}

        {activeSubTab === 'milestones' && (
          <Panel title="Company Milestones" flex={1} className="flex-1 min-h-0">
            <table className="data-table w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-bbg-border-subtle">
                  <th className="text-left px-3 py-1.5 font-medium">DATE</th>
                  <th className="text-left px-3 py-1.5 font-medium">EVENT</th>
                  <th className="text-left px-3 py-1.5 font-medium hidden md:table-cell">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {SPCX_MILESTONES.map((row) => (
                  <tr key={`${row.date}-${row.event}`} className="data-row">
                    <td className="px-3 py-1.5 text-bbg-cyan whitespace-nowrap">{row.date}</td>
                    <td className="px-3 py-1.5 text-bbg-amber">{row.event}</td>
                    <td className="px-3 py-1.5 text-bbg-gray hidden md:table-cell">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {activeSubTab === 'launches' && (
          <Panel title="Launch Schedule — SpaceX" flex={1} className="flex-1 min-h-0">
            <LaunchCalendar launches={spacexLaunches} />
          </Panel>
        )}
      </div>
    </div>
  );
}
