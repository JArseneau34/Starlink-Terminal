import { StarlinkInvestorDataDashboard } from '../investor/StarlinkInvestorDataDashboard';
import { GlobalCatalogDashboard } from '../investor/GlobalCatalogDashboard';
import { LaunchManifestDashboard } from '../investor/LaunchManifestDashboard';
import { ManifestCamLoopPanel } from '../investor/ManifestCamLoopPanel';
import { OpsStatusDashboard } from '../investor/OpsStatusDashboard';
import { OpsSettingsPanel } from '../investor/OpsSettingsPanel';
import type { OrbitalOpsView } from '../../../utils/orbitalOpsControls';

interface OrbitalOpsInvestorLayerProps {
  view: OrbitalOpsView;
}

/**
 * Fleet / Global / Manifest dashboards stay mounted (hidden when inactive) so
 * the shared query cache + local state survive tab flips without refetch thrash.
 * Mesh WebGL remains a sibling and never remounts either.
 */
export function OrbitalOpsInvestorLayer({ view }: OrbitalOpsInvestorLayerProps) {
  return (
    <>
      <div
        className="starlink-investor-view"
        hidden={view !== 'manifest'}
        aria-hidden={view !== 'manifest'}
      >
        <LaunchManifestDashboard enabled={view === 'manifest'} />
      </div>
      <div
        className="starlink-investor-view"
        hidden={view !== 'cams'}
        aria-hidden={view !== 'cams'}
      >
        <ManifestCamLoopPanel enabled={view === 'cams'} />
      </div>
      <div
        className="starlink-investor-view"
        hidden={view !== 'fleet'}
        aria-hidden={view !== 'fleet'}
      >
        <StarlinkInvestorDataDashboard enabled={view === 'fleet'} />
      </div>
      <div
        className="starlink-investor-view"
        hidden={view !== 'global'}
        aria-hidden={view !== 'global'}
      >
        <GlobalCatalogDashboard enabled={view === 'global'} />
      </div>
      <div
        className="starlink-investor-view"
        hidden={view !== 'status'}
        aria-hidden={view !== 'status'}
      >
        <OpsStatusDashboard enabled={view === 'status'} />
      </div>
      <div
        className="starlink-investor-view"
        hidden={view !== 'settings'}
        aria-hidden={view !== 'settings'}
      >
        <OpsSettingsPanel enabled={view === 'settings'} />
      </div>
    </>
  );
}
