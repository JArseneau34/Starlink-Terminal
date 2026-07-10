import type { SatStatsReview } from '../../../types/satStats';

function reviewKeyLabel(row: SatStatsReview): string {
  if (row.entity_type === 'bulk_trueup') {
    const raw = row.diff_payload;
    const diff =
      typeof raw === 'string'
        ? (JSON.parse(raw) as { field_changes?: number; oversized?: boolean })
        : (raw as { field_changes?: number; oversized?: boolean } | undefined);
    const n = diff?.field_changes;
    return `seed true-up${n != null ? ` · ${n} fields` : ''}${diff?.oversized ? ' · batch' : ''}`;
  }
  if (row.entity_type === 'starlink_scraper_log') return `${row.entity_key} · snapshot`;
  if (row.entity_key.startsWith('UPCOMING-')) return `${row.entity_key} · upcoming`;
  return `${row.entity_key} · flight`;
}

interface SatStatsReviewQueueProps {
  reviews: SatStatsReview[];
  busy: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}

export function SatStatsReviewQueue({ reviews, busy, onApprove, onReject }: SatStatsReviewQueueProps) {
  return (
    <div className="starlink-inv-block sat-stats-review">
      <div className="sat-stats-section-head">
        <div>
          <div className="mesh-overlay-label">Review queue</div>
          <p className="starlink-inv-block-desc">
            Pending launch rows and assumption flags before layer-1 commit
          </p>
        </div>
        <span className="starlink-inv-badge starlink-inv-badge--estimate">{reviews.length} open</span>
      </div>
      <div className="sat-stats-table-wrap">
        <table className="sat-stats-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Key</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={5} className="sat-stats-table-empty">
                  No pending reviews
                </td>
              </tr>
            ) : (
              reviews.slice(0, 50).map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.entity_type.replace(/_/g, ' ')}</td>
                  <td title={row.entity_key}>{reviewKeyLabel(row)}</td>
                  <td>
                    <span
                      className={`starlink-inv-badge ${
                        row.status === 'needs_assumption'
                          ? 'starlink-inv-badge--estimate'
                          : 'starlink-inv-badge--reported'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="sat-stats-table-actions">
                    <button
                      type="button"
                      className="mesh-toggle mesh-toggle-on"
                      disabled={busy}
                      onClick={() => onApprove(row.id)}
                    >
                      approve
                    </button>
                    <button
                      type="button"
                      className="mesh-toggle"
                      disabled={busy}
                      onClick={() => onReject(row.id)}
                    >
                      reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {reviews.length > 50 && (
        <p className="starlink-inv-footnote">Showing first 50 of {reviews.length} reviews</p>
      )}
    </div>
  );
}
