import {

  ORBITAL_SHELL_FILTER_COUNT,

  ORBITAL_SHELL_FILTER_SPECS,

} from '../../data/orbitalShellClassification';



interface StarlinkShellFilterProps {
  visibleShells: ReadonlySet<number>;
  onToggle: (shellIndex: number) => void;
  onToggleAll?: () => void;
  shellCounts?: readonly { shell: number; count: number | null }[];
  totalCount?: number | null;
  showGhostGrid?: boolean;
  liveAvailable?: boolean;
}



export function StarlinkShellFilter({

  visibleShells,

  onToggle,

  onToggleAll,

  shellCounts,

  totalCount,

  showGhostGrid = true,

  liveAvailable = true,

}: StarlinkShellFilterProps) {

  const shellRows = ORBITAL_SHELL_FILTER_SPECS;

  const shellTotal = ORBITAL_SHELL_FILTER_COUNT;

  const allOn = visibleShells.size >= shellTotal;

  const visibleTotal =
    totalCount ??
    shellCounts?.reduce(
      (sum, row) => sum + (visibleShells.has(row.shell) ? (row.count ?? 0) : 0),
      0
    );



  return (

    <div className="starlink-shell-filter">

      <div className="mesh-overlay-label">Orbital Shells</div>

      {onToggleAll != null && (

        <div className="mesh-toggles mb-1.5">

          <button

            type="button"

            className={`mesh-toggle mesh-shell-toggle-all${allOn ? ' mesh-toggle-on' : ''}`}

            onClick={onToggleAll}

            title="Show or hide live TLE satellites"

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

          const hex = `#${row.color.toString(16).padStart(6, '0')}`;

          const count = shellCounts?.find((c) => c.shell === row.index)?.count;

          const transit = row.status === 'transit';
          const disabled = transit && !liveAvailable;

          const title = disabled
            ? `${row.name} · transit classification requires live TLE`
            : `${row.name} · ${count != null ? `${count.toLocaleString()} fitted` : '—'} · Walker lattice fit`;

          return (

            <button

              key={row.index}

              type="button"

              disabled={disabled}

              className={`mesh-toggle mesh-shell-toggle${on ? ' mesh-toggle-on mesh-shell-toggle-on' : ''}${transit ? ' mesh-shell-toggle--transit' : ''}${disabled ? ' mesh-shell-toggle--disabled' : ''}`}

              style={

                on

                  ? ({ '--shell-accent': hex } as React.CSSProperties)

                  : undefined

              }

              onClick={() => onToggle(row.index)}

              title={title}

            >

              <span

                className="mesh-shell-toggle-dot"

                style={{ background: hex, opacity: transit ? 0.7 : 1 }}

              />

              <span className="mesh-shell-toggle-name">{row.name}</span>

              {count != null ? (
                <span className="mesh-shell-toggle-count tabular-nums">{count.toLocaleString()}</span>
              ) : (
                <span className="mesh-shell-toggle-count tabular-nums text-bbg-muted">—</span>
              )}

            </button>

          );

        })}

      </div>

      <p className="text-bbg-muted text-[8px] tracking-wide mt-1">

        {showGhostGrid

          ? 'Walker-fit counts per granted shell (+ transit when TLE live). Ghost grid shows FCC lattice slots.'

          : 'Walker-fit counts · live TLE required for transit classification'}

      </p>

    </div>

  );

}


