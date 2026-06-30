import { useMemo } from 'react';
import type { StarlinkIntelPayload } from '../../types/orbital';
import { buildCatalystTimeline } from '../../utils/starlinkCatalystTimeline';

interface StarlinkCatalystTimelineProps {
  intel: StarlinkIntelPayload | null;
  isLoading?: boolean;
}

const HORIZON_LABEL: Record<string, string> = {
  completed: 'done',
  near: 'next',
  medium: 'forward',
};

const CATEGORY_COLOR: Record<string, string> = {
  revenue: '#2ee86a',
  capacity: '#3de8ff',
  product: '#a78bfa',
  capital: '#ffc24b',
};

export function StarlinkCatalystTimeline({ intel, isLoading }: StarlinkCatalystTimelineProps) {
  const timeline = useMemo(() => buildCatalystTimeline(intel), [intel]);

  if (isLoading && !intel) {
    return (
      <div className="starlink-inv-block starlink-inv-block--catalysts">
        <div className="mesh-overlay-label">Catalyst Timeline</div>
        <div className="text-bbg-muted text-[10px] py-2">Loading catalyst map…</div>
      </div>
    );
  }

  const upcoming = timeline.events.filter((e) => e.horizon !== 'completed').slice(0, 4);
  const recent = timeline.events.filter((e) => e.horizon === 'completed').slice(-3).reverse();

  return (
    <div className="starlink-inv-block starlink-inv-block--catalysts starlink-cat">
      <div className="starlink-cat-head">
        <div>
          <div className="mesh-overlay-label mb-0">Catalyst Timeline</div>
          <p className="starlink-inv-block-desc">What moves the valuation story next</p>
        </div>
        {timeline.nextCatalyst && (
          <div className="starlink-cat-next" title={timeline.nextCatalyst.valuationHook}>
            <span>next up</span>
            <b>{timeline.nextCatalyst.title}</b>
          </div>
        )}
      </div>

      <div className="starlink-cat-section">
        <div className="starlink-inv-list-label">Upcoming catalysts</div>
        <div className="starlink-cat-list">
          {upcoming.map((event) => (
            <article
              key={event.id}
              className={`starlink-cat-event starlink-cat-event--${event.horizon}`}
              style={{ '--cat-accent': CATEGORY_COLOR[event.category] } as React.CSSProperties}
              title={event.valuationHook}
            >
              <div className="starlink-cat-event-rail">
                <i />
              </div>
              <div className="starlink-cat-event-body">
                <div className="starlink-cat-event-meta">
                  <span className="starlink-cat-date">{event.dateLabel}</span>
                  <span className="starlink-cat-horizon">{HORIZON_LABEL[event.horizon]}</span>
                  <span className={`starlink-cat-impact starlink-cat-impact--${event.impact}`}>
                    {event.impact}
                  </span>
                </div>
                <h4 className="starlink-cat-title">{event.title}</h4>
                <p className="starlink-cat-detail">{event.detail}</p>
                <p className="starlink-cat-hook">{event.valuationHook}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="starlink-cat-section">
        <div className="starlink-inv-list-label">Recent proof points</div>
        <div className="starlink-inv-milestones starlink-cat-milestones">
          {recent.map((event) => (
            <div
              key={event.id}
              className="starlink-inv-milestone"
              title={event.valuationHook}
            >
              <time className="starlink-inv-ms-date">{event.dateLabel}</time>
              <p className="starlink-inv-ms-event">{event.title}</p>
              <p className="starlink-inv-ms-detail">{event.valuationHook}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
