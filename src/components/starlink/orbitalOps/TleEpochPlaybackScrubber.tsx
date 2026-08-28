import type { TleEpochPlaybackState } from '../../../hooks/useTleEpochPlayback';

function formatDayLabel(date: string): string {
  const t = Date.parse(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return date;
  return new Date(t).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * TLE epoch archive scrubber — Live vs historical mesh catalog (daily + weekly backfill).
 */
export function TleEpochPlaybackScrubber({
  playback,
}: {
  playback: TleEpochPlaybackState;
}) {
  const {
    available,
    dates,
    scrubIndex,
    setScrubIndex,
    goLive,
    playbackDate,
    loadingIndex,
    loadingCatalog,
    error,
    playing,
    setPlaying,
    yearTicks,
  } = playback;

  if (!available && !loadingIndex) {
    return (
      <div className="mesh-overlay orbital-ops-panel-section orbital-ops-playback">
        <span className="orbital-ops-dock-label">epoch playback</span>
        <p className="orbital-ops-dock-hint">
          No TLE archive yet — live days appear after the API writes today&apos;s cache. For
          2019→now growth, run <code>npm run tle-epochs:backfill</code> (Space-Track).
        </p>
      </div>
    );
  }

  const isLive = playbackDate == null;
  const dayLabel = playbackDate ? formatDayLabel(playbackDate) : 'Live';
  const spanLabel =
    dates.length > 400 ? 'epochs' : dates.length > 60 ? 'weeks+' : 'days';

  return (
    <div className="mesh-overlay orbital-ops-panel-section orbital-ops-playback">
      <div className="mesh-control-label">
        epoch playback{' '}
        <b className="tabular-nums">
          {loadingCatalog ? 'loading…' : dayLabel}
          {!isLive ? ' · replay' : ''}
        </b>
      </div>
      <input
        type="range"
        className="mesh-range"
        min={0}
        max={Math.max(0, dates.length - 1)}
        step={1}
        disabled={dates.length === 0}
        value={isLive ? dates.length - 1 : Math.max(0, scrubIndex)}
        onChange={(e) => setScrubIndex(Number(e.target.value))}
        aria-label="TLE epoch scrubber"
      />
      <div className="orbital-ops-playback-meta tabular-nums">
        <span>{dates[0] ?? '—'}</span>
        <span>
          {dates.length} {spanLabel}
          {yearTicks.length > 1 ? ` · ${yearTicks[0]}–${yearTicks[yearTicks.length - 1]}` : ''}
        </span>
        <span>{dates[dates.length - 1] ?? '—'}</span>
      </div>
      {yearTicks.length > 1 ? (
        <div className="orbital-ops-playback-years tabular-nums" aria-hidden>
          {yearTicks.map((y) => (
            <button
              key={y}
              type="button"
              className="orbital-ops-playback-year"
              onClick={() => {
                const i = dates.findIndex((d) => d.startsWith(`${y}-`));
                if (i >= 0) setScrubIndex(i);
              }}
            >
              {y}
            </button>
          ))}
        </div>
      ) : null}
      <div className="orbital-ops-playback-actions">
        <button
          type="button"
          className={`mesh-toggle${isLive ? ' mesh-toggle-on' : ''}`}
          onClick={goLive}
          disabled={isLive}
        >
          live
        </button>
        <button
          type="button"
          className={`mesh-toggle${playing ? ' mesh-toggle-on' : ''}`}
          disabled={dates.length === 0}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? 'pause' : 'play'}
        </button>
        <button
          type="button"
          className="mesh-toggle"
          disabled={dates.length === 0 || scrubIndex <= 0}
          onClick={() => setScrubIndex(scrubIndex <= 0 ? 0 : scrubIndex - 1)}
        >
          ◀
        </button>
        <button
          type="button"
          className="mesh-toggle"
          disabled={dates.length === 0 || (!isLive && scrubIndex >= dates.length - 1)}
          onClick={() => {
            if (isLive) setScrubIndex(dates.length - 1);
            else setScrubIndex(scrubIndex + 1);
          }}
        >
          ▶
        </button>
      </div>
      {error ? <p className="orbital-ops-dock-hint orbital-ops-playback-err">{error}</p> : null}
      {!isLive ? (
        <p className="orbital-ops-dock-hint">
          Historical SGP4 @ 12:00 UTC — OEM / live polls paused. Weekly history via Space-Track
          backfill; forward days from live TLE archive.
        </p>
      ) : null}
    </div>
  );
}
