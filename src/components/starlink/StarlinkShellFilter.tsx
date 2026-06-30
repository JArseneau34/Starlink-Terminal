import { STARLINK_SHELLS, shellHex, shellTopologyLabel } from './starlinkCatalog';
import { VISUAL_SHELL_COUNT, VISUAL_SHELL_SPECS } from '../../data/starlinkVisualShells';
import type { StarlinkMeshMode } from '../../types/orbital';

interface StarlinkShellFilterProps {
  visibleShells: ReadonlySet<number>;
  onToggle: (shellIndex: number) => void;
  onToggleAll?: () => void;
  shellCounts?: readonly { shell: number; count: number }[];
  totalCount?: number;
  meshMode?: StarlinkMeshMode;
}

export function StarlinkShellFilter({
  visibleShells,
  onToggle,
  onToggleAll,
  shellCounts,
  totalCount,
  meshMode = 'topology',
}: StarlinkShellFilterProps) {
  const isLive = meshMode === 'live';
  const shellRows = isLive
    ? VISUAL_SHELL_SPECS.map((spec) => ({
        index: spec.index,
        name: spec.name,
        color: spec.color,
        generation: null as 'gen1' | 'gen2' | null,
        topology: null as ReturnType<typeof shellTopologyLabel> | null,
      }))
    : STARLINK_SHELLS.map((sh, i) => ({
        index: i,
        name: sh.name,
        color: sh.color,
        generation: sh.generation,
        topology: shellTopologyLabel(sh),
      }));
  const shellTotal = isLive ? VISUAL_SHELL_COUNT : STARLINK_SHELLS.length;
  const allOn = visibleShells.size >= shellTotal;
  const visibleTotal =
    totalCount ??
    shellCounts?.reduce(
      (sum, row) => sum + (visibleShells.has(row.shell) ? row.count : 0),
      0
    );

  return (
    <div className="starlink-shell-filter">
      <div className="mesh-overlay-label">Starlink Shells</div>
      {onToggleAll != null && (
        <div className="mesh-toggles mb-1.5">
          <button
            type="button"
            className={`mesh-toggle mesh-shell-toggle-all${allOn ? ' mesh-toggle-on' : ''}`}
            onClick={onToggleAll}
            title="Show or hide the full constellation"
          >
            <span className="mesh-shell-toggle-name">all satellites</span>
            {visibleTotal != null && (
              <span className="mesh-shell-toggle-count tabular-nums">
                {visibleTotal.toLocaleString()}
              </span>
            )}
          </button>
        </div>
      )}
      <div className="mesh-toggles mesh-shell-toggles">
        {shellRows.map((row) => {
          const on = visibleShells.has(row.index);
          const hex = shellHex(row.color);
          const count = shellCounts?.find((c) => c.shell === row.index)?.count;
          const title = isLive
            ? `${row.name} · ${count != null ? `${count.toLocaleString()} tracked` : 'live TLE'} · mission shell`
            : `${row.name} · ${row.generation?.toUpperCase() ?? ''} · Walker ${row.topology ?? ''}`;
          return (
            <button
              key={`${meshMode}-${row.name}`}
              type="button"
              className={`mesh-toggle mesh-shell-toggle${on ? ' mesh-toggle-on mesh-shell-toggle-on' : ''}`}
              style={
                on
                  ? ({ '--shell-accent': hex } as React.CSSProperties)
                  : undefined
              }
              onClick={() => onToggle(row.index)}
              title={title}
            >
              <span className="mesh-shell-toggle-dot" style={{ background: hex }} />
              <span className="mesh-shell-toggle-name">{row.name}</span>
              {count != null && (
                <span className="mesh-shell-toggle-count tabular-nums">{count.toLocaleString()}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-bbg-muted text-[8px] tracking-wide mt-1">
        {isLive
          ? 'Mission shells from live TLE positions — factual NORAD counts'
          : 'Walker topology shells — synthetic model, toggle satellites and ISL links'}
      </p>
    </div>
  );
}
