/**
 * Isolation + frame-ancestors for Orbital Ops inside Orion.
 *
 * Standalone docs keep COOP/COEP (SharedArrayBuffer workers). An iframe
 * navigation (or `?embed=1` / `/embed/ops`) must not send those headers —
 * COOP: same-origin cannot be framed. Embed falls back to main-thread SGP4.
 */

export const DEFAULT_FRAME_ANCESTORS = [
  "'self'",
  'http://localhost:3047',
  'http://127.0.0.1:3047',
  'http://localhost:3040',
  'https://*.33fg.ai',
].join(' ');

export function coopCoepHeaders(): Record<string, string> {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  };
}

export function urlHasEmbedFlag(raw: string): boolean {
  try {
    const u = new URL(raw, 'http://vite.local');
    if (u.pathname === '/embed/ops' || u.pathname.startsWith('/embed/ops/')) {
      return true;
    }
    const v = u.searchParams.get('embed');
    return v === '1' || v === 'true';
  } catch {
    return /(?:^|[?&])embed=(?:1|true)(?:&|$)/.test(raw);
  }
}

export function isFramedDocumentRequest(req: {
  url?: string;
  headers?: { [key: string]: unknown };
}): boolean {
  const headers = req.headers || {};
  const dest = String(
    headers['sec-fetch-dest'] || headers['Sec-Fetch-Dest'] || ''
  ).toLowerCase();
  if (dest === 'iframe' || dest === 'embed' || dest === 'frame') return true;
  return urlHasEmbedFlag(req.url || '');
}

export function frameAncestorsCsp(extra?: string): string {
  const more = String(extra ?? process.env.SAT_STATS_FRAME_ANCESTORS ?? '').trim();
  const list = more ? `${DEFAULT_FRAME_ANCESTORS} ${more}` : DEFAULT_FRAME_ANCESTORS;
  return `frame-ancestors ${list}`;
}

export function documentIsolationHeaders(req: {
  url?: string;
  headers?: { [key: string]: unknown };
}): Record<string, string> {
  if (isFramedDocumentRequest(req)) {
    return {
      'Content-Security-Policy': frameAncestorsCsp(),
    };
  }
  return coopCoepHeaders();
}
