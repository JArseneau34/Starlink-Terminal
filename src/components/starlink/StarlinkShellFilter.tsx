import { STARLINK_SHELLS, shellHex, shellTopologyLabel } from './starlinkCatalog';

interface StarlinkShellFilterProps {
  visibleShells: ReadonlySet<number>;
  onToggle: (shellIndex: number) => void;
  shellCounts?: readonly { shell: number; count: number }[];
}

export function StarlinkShellFilter({
  visibleShells,
  onToggle,
  shellCounts,
}: StarlinkShellFilterProps) {
  return (
    <div className="starlink-shell-filter">
      <div className="mesh-overlay-label">Starlink Shells</div>
      <div className="mesh-toggles mesh-shell-toggles">
        {STARLINK_SHELLS.map((sh, i) => {
          const on = visibleShells.has(i);
          const hex = shellHex(sh.color);
          const count = shellCounts?.find((c) => c.shell === i)?.count;
          return (
            <button
              key={sh.name}
              type="button"
              className={`mesh-toggle mesh-shell-toggle${on ? ' mesh-toggle-on mesh-shell-toggle-on' : ''}`}
              style={
                on
                  ? ({ '--shell-accent': hex } as React.CSSProperties)
                  : undefined
              }
              onClick={() => onToggle(i)}
              title={`${sh.name} · ${sh.generation.toUpperCase()} · ${shellTopologyLabel(sh)}`}
            >
              <span className="mesh-shell-toggle-dot" style={{ background: hex }} />
              <span className="mesh-shell-toggle-name">{sh.name}</span>
              {count != null && (
                <span className="mesh-shell-toggle-count tabular-nums">{count.toLocaleString()}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-bbg-muted text-[8px] tracking-wide mt-1">
        Filter shells · one must stay on
      </p>
    </div>
  );
}
