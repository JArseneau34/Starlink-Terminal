import type { FleetTierExclusions, FleetTierKpis } from '../../utils/fleetTierKpis';
import { FLEET_TIER_TOOLTIPS, formatTierValue } from '../../utils/fleetTierKpis';

interface FleetTierKpiCardsProps {
  kpis: FleetTierKpis;
  loading?: boolean;
}

function ExclusionStrip({ exclusions, live }: { exclusions: FleetTierExclusions; live: boolean }) {
  if (!live) return null;
  return (
    <div className="orbital-ops-tier-exclusions" aria-label="Excluded from working tier">
      <span title="TLE epoch older than 7 days">−{exclusions.staleElement.toLocaleString()} stale</span>
      <span title="Perigee &lt;220 km or uncontrolled decay">
        −{exclusions.uncontrolledDecay.toLocaleString()} decay
      </span>
      <span title="Orbit-raising, deorbiting, or outside FCC shell bins">
        −{exclusions.transit.toLocaleString()} transit
      </span>
    </div>
  );
}

export function FleetTierKpiCards({ kpis, loading = false }: FleetTierKpiCardsProps) {
  const tiers = [
    { key: 'inOrbit' as const, label: 'In orbit', tooltip: FLEET_TIER_TOOLTIPS.inOrbit, value: kpis.inOrbit, sub: kpis.sources.inOrbit },
    { key: 'working' as const, label: 'Working', tooltip: FLEET_TIER_TOOLTIPS.working, value: kpis.working, sub: kpis.sources.working },
    {
      key: 'operational' as const,
      label: 'Operational',
      tooltip: FLEET_TIER_TOOLTIPS.operational,
      value: kpis.operational,
      sub: kpis.sources.operational,
    },
  ];

  return (
    <div className={`orbital-ops-tier-kpis${kpis.liveAvailable ? '' : ' orbital-ops-tier-kpis--offline'}`}>
      {tiers.map((tier) => (
        <div
          key={tier.key}
          className="orbital-ops-sat-count-card orbital-ops-tier-card"
          title={tier.tooltip}
        >
          <div className="orbital-ops-sat-count-label">{tier.label}</div>
          <div className="orbital-ops-sat-count-value tabular-nums">
            {formatTierValue(tier.value, loading)}
          </div>
          <div className="orbital-ops-sat-count-sub">{tier.sub}</div>
          {tier.key === 'working' ? (
            <ExclusionStrip exclusions={kpis.exclusions} live={kpis.liveAvailable} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
