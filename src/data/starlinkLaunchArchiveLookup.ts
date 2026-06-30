import type { StarlinkLaunchArchiveEntry } from './starlinkLaunchArchive';
import { STARLINK_LAUNCH_ARCHIVE } from './starlinkLaunchArchive';

const GROUP_KEY_RE = /starlink\s+group\s+(\d+)\s*-\s*(\d+)/i;

export function extractStarlinkGroupKey(text: string): string | null {
  const m = text.match(GROUP_KEY_RE);
  return m ? `${m[1]}-${m[2]}` : null;
}

function buildGroupIndex(): Map<string, StarlinkLaunchArchiveEntry> {
  const index = new Map<string, StarlinkLaunchArchiveEntry>();
  for (const entry of STARLINK_LAUNCH_ARCHIVE) {
    const key = entry.payload ? extractStarlinkGroupKey(entry.payload) : null;
    if (!key || index.has(key)) continue;
    index.set(key, entry);
  }
  return index;
}

const ARCHIVE_BY_GROUP = buildGroupIndex();

export function lookupLaunchArchiveByGroup(groupKey: string): StarlinkLaunchArchiveEntry | null {
  return ARCHIVE_BY_GROUP.get(groupKey) ?? null;
}

export function lookupLaunchArchiveByName(name: string): StarlinkLaunchArchiveEntry | null {
  const key = extractStarlinkGroupKey(name);
  return key ? lookupLaunchArchiveByGroup(key) : null;
}

export function lookupLaunchArchiveByDate(dateUtc: string): StarlinkLaunchArchiveEntry[] {
  return STARLINK_LAUNCH_ARCHIVE.filter((entry) => entry.dateUtc === dateUtc);
}
