import type Database from 'better-sqlite3';
import type { SatStatsSourceId } from './types.js';

export interface SourcePolicy {
  source_id: SatStatsSourceId;
  display_name: string;
  terms_url: string | null;
  republish_allowed: boolean;
  robots_respected: boolean;
  notes: string | null;
}

const DEFAULT_POLICIES: SourcePolicy[] = [
  {
    source_id: 'spacetrack',
    display_name: 'Space-Track.org',
    terms_url: 'https://www.space-track.org/documentation',
    republish_allowed: false,
    robots_respected: true,
    notes: 'Verify/catalog only; raw dumps not republished.',
  },
  {
    source_id: 'celestrak',
    display_name: 'CelesTrak',
    terms_url: 'https://celestrak.org/NORAD/documentation/gp-data-treaty.php',
    republish_allowed: false,
    robots_respected: true,
    notes: 'GP elements for orbit propagation; archive snapshots locally.',
  },
  {
    source_id: 'launch_library_2',
    display_name: 'Launch Library 2',
    terms_url: 'https://thespacedevs.com/llapi',
    republish_allowed: false,
    robots_respected: true,
    notes: 'SpaceX-filtered launch schedule and outcomes.',
  },
  {
    source_id: 'fcc',
    display_name: 'FCC ECFS / constellation reports',
    terms_url: 'https://www.fcc.gov/ecfs',
    republish_allowed: false,
    robots_respected: true,
    notes: 'Public filings; archive PDFs/HTML, cite filings on fact pages.',
  },
  {
    source_id: 'spacex_press',
    display_name: 'SpaceX launch pages / press kits',
    terms_url: 'https://www.spacex.com',
    republish_allowed: false,
    robots_respected: true,
    notes: 'Event-driven scrape; archived locally, not republished.',
  },
  {
    source_id: 'mcdowell',
    display_name: 'Jonathan McDowell Starlink stats',
    terms_url: 'https://planet4589.org/space/con/star/stats.html',
    republish_allowed: false,
    robots_respected: true,
    notes: 'Fleet working counts; cross-check with FCC attrition.',
  },
  {
    source_id: 'wikipedia_bootstrap',
    display_name: 'Wikipedia launch lists (bootstrap)',
    terms_url: 'https://en.wikipedia.org/wiki/List_of_Falcon_9_and_Falcon_Heavy_launches',
    republish_allowed: false,
    robots_respected: true,
    notes: 'One-time bootstrap only; rows enter via review queue.',
  },
];

export function ensurePolicyRegister(conn: Database.Database): void {
  const stmt = conn.prepare(`
    INSERT OR IGNORE INTO source_policy(source_id, display_name, terms_url, republish_allowed, robots_respected, notes)
    VALUES (@source_id, @display_name, @terms_url, @republish_allowed, @robots_respected, @notes)
  `);
  for (const p of DEFAULT_POLICIES) {
    stmt.run({
      ...p,
      republish_allowed: p.republish_allowed ? 1 : 0,
      robots_respected: p.robots_respected ? 1 : 0,
    });
  }
}

export function listPolicies(conn: Database.Database): SourcePolicy[] {
  ensurePolicyRegister(conn);
  const rows = conn
    .prepare('SELECT * FROM source_policy ORDER BY source_id')
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    source_id: String(r.source_id) as SatStatsSourceId,
    display_name: String(r.display_name),
    terms_url: r.terms_url ? String(r.terms_url) : null,
    republish_allowed: Boolean(r.republish_allowed),
    robots_respected: Boolean(r.robots_respected),
    notes: r.notes ? String(r.notes) : null,
  }));
}
