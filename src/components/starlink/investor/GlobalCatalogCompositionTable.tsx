import type { GlobalCatalogObjectKindRow, GlobalCatalogViewScope } from '../../../types/globalCatalog';
import { fmtMetric } from './satStatsChartTheme';

interface GlobalCatalogCompositionTableProps {
  rows: GlobalCatalogObjectKindRow[];
  viewScope: GlobalCatalogViewScope;
}

export function GlobalCatalogCompositionTable({ rows, viewScope }: GlobalCatalogCompositionTableProps) {
  const scope = viewScope === 'orbital' ? 'orbital' : 'all';

  return (
    <div className="starlink-inv-block global-catalog-composition">
      <div className="mesh-overlay-label">Catalogue composition</div>
      <p className="starlink-inv-block-desc">
        All catalogued objects ({scope} activity), broken down by kind. Active = currently in orbit (GCAT status O).
      </p>
      <div className="sat-stats-table-wrap">
        <table className="sat-stats-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Total</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="sat-stats-table-empty">
                  No composition data — bootstrap GCAT and compute a snapshot.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.kind} className={row.kind === 'total' ? 'global-catalog-kind-total' : undefined}>
                  <td>{row.label}</td>
                  <td>{fmtMetric(row.total)}</td>
                  <td>{fmtMetric(row.active)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
