/**
 * Vite `base` prefix so the SPA can mount under Orion's `/mesh` proxy.
 * Standalone (`base: '/'`) leaves root-absolute `/api` and `/textures` unchanged.
 */

export function satStatsBase(): string {
  try {
    const raw = import.meta.env && import.meta.env.BASE_URL;
    if (raw == null || raw === '' || raw === '/') return '';
    return String(raw).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Prefix a root-absolute path with Vite base. Leaves http(s) and already-prefixed paths alone. */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  const base = satStatsBase();
  if (!base) return path;
  if (path === base || path.startsWith(base + '/')) return path;
  return base + path;
}
