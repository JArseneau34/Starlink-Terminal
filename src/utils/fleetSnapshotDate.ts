import { STARLINK_FLEET_SNAPSHOT } from '../data/starlinkFleetSnapshot';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reject corrupted sat-stats month_end rows (e.g. projection years like 2039). */
export function isPlausibleFleetSnapshotDate(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim();
  if (!ISO_DATE.test(text)) return false;
  const year = Number(text.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  const nowYear = new Date().getUTCFullYear();
  if (year < 2000 || year > nowYear + 1) return false;
  const endMs = Date.parse(`${text}T23:59:59Z`);
  if (!Number.isFinite(endMs)) return false;
  // Drop forward-looking projection rows baked into sat-stats feeds.
  return endMs <= Date.now() + 45 * 86_400_000;
}

export function sanitizeFleetSnapshotDate(
  value: string | null | undefined,
  fallback: string = STARLINK_FLEET_SNAPSHOT.snapshotDate
): string {
  const text = String(value ?? '').trim();
  return isPlausibleFleetSnapshotDate(text) ? text : fallback;
}

export function pickLatestPlausibleMonthEnd<T extends { month_end?: string }>(
  rows: readonly T[] | undefined
): T | null {
  if (!rows?.length) return null;
  const plausible = rows.filter((r) => isPlausibleFleetSnapshotDate(r.month_end));
  if (!plausible.length) return null;
  return [...plausible].sort((a, b) =>
    String(a.month_end).localeCompare(String(b.month_end))
  ).at(-1)!;
}
