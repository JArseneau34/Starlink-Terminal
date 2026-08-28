/**
 * Orion embed mode — `?embed=1` (or `/embed/ops`) so Orbital Ops can live
 * inside Orion chrome. Isolation headers are stripped server-side; this
 * module is the client signal (hide duplicate brand, skip the wizard).
 */

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
