/**
 * Orion embed mode — `?embed=1` (or `/embed/ops`) so Orbital Ops can live
 * inside Orion chrome. Isolation headers are stripped server-side; this
 * module is the client signal (hide duplicate brand, skip the wizard).
 *
 * Orion `/api/self` satstats must be this origin + query — never same-origin
 * `/constellation/` (that prefix was only for a vendored copy under Orion).
 * Production Vite `base` is `/`. Dev Vite is `/mesh/` (local proxy only).
 */

/** Live Node host. UAT Orion should iframe a UAT Sat Stats origin instead. */
export const DEFAULT_PUBLIC_ORIGIN = 'https://app.sat-stats.33fg.com';
export const ORION_EMBED_QUERY = 'embed=1&tab=ops';

function trimOrigin(raw: string): string {
  const s = String(raw || '').trim();
  try {
    const href = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
    return new URL(href).origin;
  } catch {
    return s.replace(/\/+$/, '').replace(/\/constellation$/i, '');
  }
}

/** iframe src Orion stores (env). Not `/constellation/`. */
export function orionEmbedSrc(origin: string = DEFAULT_PUBLIC_ORIGIN): string {
  return `${trimOrigin(origin)}/?${ORION_EMBED_QUERY}`;
}

export function isOrionEmbedSearch(search: string | URLSearchParams): boolean {
  const params =
    typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
  const v = params.get('embed');
  return v === '1' || v === 'true';
}

export function isOrionEmbedPath(pathname: string): boolean {
  const p = pathname.split('?')[0] || '';
  return p === '/embed/ops' || p.startsWith('/embed/ops/');
}

export function isOrionEmbed(
  search?: string | URLSearchParams,
  pathname?: string
): boolean {
  if (typeof window === 'undefined' && search == null && pathname == null) {
    return false;
  }
  const s =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const p =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return isOrionEmbedSearch(s) || isOrionEmbedPath(p);
}

export function applyOrionEmbedClass(): void {
  if (typeof document === 'undefined') return;
  if (isOrionEmbed()) document.documentElement.classList.add('orion-embed');
  else document.documentElement.classList.remove('orion-embed');
}
