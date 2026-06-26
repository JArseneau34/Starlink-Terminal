/** Accept only HTTPS image URLs for the news wire. */
export function normalizeNewsImageUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return undefined;
  return trimmed;
}
